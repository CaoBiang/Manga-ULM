from flask import jsonify, request, Response, stream_with_context
from . import api
from ...models import File, Tag
from ... import db
import os
import re
from loguru import logger
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.expression import func
from ...infrastructure.archive_reader import (
    get_entry_by_index,
    get_entry_metadata as get_cached_entry_metadata,
    guess_mimetype,
    iter_entry_chunks,
)
from ...services.settings_service import get_int_setting
from ...tasks.rename import sanitize_filename
READING_STATUS_OPTIONS = {'unread', 'in_progress', 'finished'}
SORTABLE_COLUMNS = {
    'add_date': lambda: File.add_date,
    'file_path': lambda: func.lower(File.file_path),
    'file_size': lambda: func.coalesce(File.file_size, 0),
    'total_pages': lambda: func.coalesce(File.total_pages, 0),
    'last_read_date': lambda: File.last_read_date,
    'last_read_page': lambda: func.coalesce(File.last_read_page, 0),
    'reading_status': lambda: File.reading_status,
}

def file_to_dict(file_obj, is_liked=False):
    """Converts a File object to a dictionary."""
    display_name = os.path.basename(file_obj.file_path) if file_obj.file_path else ''
    parent_folder = ''
    if file_obj.file_path:
        parent_folder = os.path.basename(os.path.dirname(file_obj.file_path)) if os.path.dirname(file_obj.file_path) else ''

    total_pages = file_obj.total_pages or 0
    last_read_page = file_obj.last_read_page or 0
    progress_percent = None
    if total_pages <= 0:
        progress_percent = 0
    elif total_pages == 1:
        progress_percent = 100 if last_read_page >= 0 else 0
    else:
        progress_percent = max(0, min(100, round((last_read_page / (total_pages - 1)) * 100)))

    data = {
        'id': file_obj.id,
        'file_path': file_obj.file_path,
        'display_name': display_name,
        'folder_name': parent_folder,
        'file_hash': file_obj.file_hash,
        'file_size': file_obj.file_size,
        'add_date': file_obj.add_date.isoformat() if file_obj.add_date else None,
        'total_pages': file_obj.total_pages,
        'spread_pages': file_obj.spread_pages,
        'last_read_page': file_obj.last_read_page,
        'last_read_date': file_obj.last_read_date.isoformat() if file_obj.last_read_date else None,
        'reading_status': file_obj.reading_status,
        'progress_percent': progress_percent,
        'is_missing': file_obj.is_missing,
        'integrity_status': file_obj.integrity_status,
        'cover_url': f'/api/v1/covers/{file_obj.file_hash}.webp',
        'tags': [{'id': t.id, 'name': t.name, 'type_id': t.type_id} for t in file_obj.tags],
        'tag_ids': [t.id for t in file_obj.tags]
    }
    # If is_liked is passed as True, we trust it.
    # Otherwise, we check the relationship. This is useful for lists of likes.
    if is_liked:
        data['is_liked'] = True
    else:
        # The relationship will be named 'like_item' after the model change
        data['is_liked'] = file_obj.like_item is not None
    if file_obj.like_item:
        data['liked_at'] = file_obj.like_item.added_at.isoformat() if file_obj.like_item.added_at else None
    return data

def build_page_response(file_path, page_num):
    """
    按页流式返回图片，避免整本或整页一次性堆入内存。
    """
    entry = get_entry_by_index(file_path, page_num)
    if entry is None:
        return None

    mimetype = guess_mimetype(entry.name)
    content_length = entry.size
    chunk_kb = get_int_setting('reader.stream.chunk_kb', default=512, min_value=64, max_value=4096)
    chunk_size = chunk_kb * 1024

    def generate():
        yield from iter_entry_chunks(file_path, entry, chunk_size=chunk_size)

    response = Response(stream_with_context(generate()), mimetype=mimetype, direct_passthrough=True)
    if content_length:
        response.headers['Content-Length'] = str(content_length)
    # 避免浏览器缓存过期图片，交给前端自行控制
    response.headers['Cache-Control'] = 'no-store'
    return response


def parse_int_list(raw_value):
    """Parse a comma separated list of integers."""
    if not raw_value:
        return []
    result = []
    for item in raw_value.split(','):
        item = item.strip()
        if not item:
            continue
        try:
            result.append(int(item))
        except ValueError:
            raise ValueError(f'Invalid integer value "{item}"')
    return result


def parse_bool(raw_value):
    """Parse a boolean-like string; returns True/False or None if indeterminate."""
    if raw_value is None:
        return None
    value = raw_value.strip().lower()
    if value in {'1', 'true', 'yes', 'y', 'on', 'only'}:
        return True
    if value in {'0', 'false', 'no', 'n', 'off'}:
        return False
    return None

def get_page_details_from_archive(file_path, page_num):
    """
    复用索引缓存返回页面元数据，避免大文件重复解压。
    """
    try:
        metadata = get_cached_entry_metadata(file_path, page_num)
        if metadata:
            return metadata
    except Exception as exc:
        logger.warning('获取页面元数据失败: {} | 页码: {} | 错误: {}', file_path, page_num, exc)
        return None, None
    return None, None

@api.route('/files', methods=['GET'])
def get_files():
    """
    Get a paginated list of files with optional sorting and filtering.
    """
    page = max(1, request.args.get('page', 1, type=int))
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 200))
    sort_by = (request.args.get('sort_by') or 'add_date').lower()
    sort_order = (request.args.get('sort_order') or 'desc').lower()
    keyword = request.args.get('keyword', '').strip()
    is_missing_param = request.args.get('is_missing')
    include_missing_param = request.args.get('include_missing')
    tag_ids_param = request.args.get('tags')
    exclude_tag_ids_param = request.args.get('exclude_tags')
    tag_mode = (request.args.get('tag_mode') or 'any').lower()
    include_descendants_param = request.args.get('include_descendants')
    status_param = request.args.get('statuses') or request.args.get('status')
    liked_param = request.args.get('liked')
    min_pages = request.args.get('min_pages', type=int)
    max_pages = request.args.get('max_pages', type=int)
    min_size = request.args.get('min_size', type=int)
    max_size = request.args.get('max_size', type=int)

    try:
        tag_ids = parse_int_list(tag_ids_param)
        exclude_tag_ids = parse_int_list(exclude_tag_ids_param)
    except ValueError as err:
        return jsonify({'error': str(err)}), 400

    if tag_mode not in {'any', 'all'}:
        return jsonify({'error': 'tag_mode must be either "any" or "all".'}), 400

    statuses = []
    if status_param:
        statuses = [
            status.strip().lower()
            for status in status_param.split(',')
            if status.strip()
        ]
        invalid_statuses = [status for status in statuses if status not in READING_STATUS_OPTIONS]
        if invalid_statuses:
            return jsonify({'error': f'Invalid status value(s): {invalid_statuses}'}), 400

    liked_flag = parse_bool(liked_param)
    include_missing_flag = parse_bool(include_missing_param)
    include_descendants_flag = parse_bool(include_descendants_param)

    # Basic query
    query = File.query.options(
        selectinload(File.tags),
        selectinload(File.like_item)
    )

    # Filtering
    if keyword:
        for token in keyword.split():
            token_like = f'%{token}%'
            query = query.filter(File.file_path.ilike(token_like))

    # Optionally expand tag filters to include descendants
    def expand_with_descendants(ids):
        if not ids:
            return []
        # Build parent->children map once
        pairs = db.session.query(Tag.id, Tag.parent_id).all()
        children_map = {}
        for tid, pid in pairs:
            children_map.setdefault(pid, []).append(tid)
        out = set()
        from collections import deque
        for root in ids:
            dq = deque([root])
            while dq:
                cur = dq.popleft()
                if cur in out:
                    continue
                out.add(cur)
                for child in children_map.get(cur, []):
                    dq.append(child)
        return list(out)

    if include_descendants_flag:
        tag_ids = expand_with_descendants(tag_ids)
        exclude_tag_ids = expand_with_descendants(exclude_tag_ids)

    if tag_ids:
        if tag_mode == 'all':
            for tid in tag_ids:
                query = query.filter(File.tags.any(Tag.id == tid))
        else:
            query = query.filter(File.tags.any(Tag.id.in_(tag_ids)))

    if exclude_tag_ids:
        for tid in exclude_tag_ids:
            query = query.filter(~File.tags.any(Tag.id == tid))

    if statuses:
        query = query.filter(File.reading_status.in_(statuses))

    if liked_flag is True:
        query = query.filter(File.like_item.has())
    elif liked_flag is False:
        query = query.filter(~File.like_item.has())

    if min_pages is not None:
        query = query.filter(func.coalesce(File.total_pages, 0) >= min_pages)
    if max_pages is not None:
        query = query.filter(func.coalesce(File.total_pages, 0) <= max_pages)

    if min_size is not None:
        query = query.filter(func.coalesce(File.file_size, 0) >= min_size)
    if max_size is not None:
        query = query.filter(func.coalesce(File.file_size, 0) <= max_size)

    if is_missing_param is not None:
        is_missing_flag = parse_bool(is_missing_param)
        if is_missing_flag is None:
            return jsonify({'error': 'is_missing must be a boolean.'}), 400
        query = query.filter(File.is_missing == is_missing_flag)
    else:
        # Default to not showing missing files unless explicitly requested or include_missing is true
        if include_missing_flag is not True:
            query = query.filter(File.is_missing.is_(False))

    # Sorting
    if sort_by == 'random':
        query = query.order_by(func.random())
    else:
        sort_factory = SORTABLE_COLUMNS.get(sort_by)
        if sort_factory is None:
            return jsonify({'error': f'Unsupported sort_by value "{sort_by}".'}), 400
        sort_column = sort_factory()
        if sort_order == 'asc':
            query = query.order_by(sort_column.asc(), File.id.asc())
        else:
            query = query.order_by(sort_column.desc(), File.id.desc())

    # Pagination
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    files = pagination.items

    return jsonify({
        'files': [file_to_dict(f) for f in files],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total_pages': pagination.pages,
            'total_items': pagination.total
        },
        'sort': {
            'by': sort_by,
            'order': sort_order
        },
        'filters': {
            'keyword': keyword,
            'tag_ids': tag_ids,
            'exclude_tag_ids': exclude_tag_ids,
            'statuses': statuses,
            'liked': liked_flag,
            'min_pages': min_pages,
            'max_pages': max_pages,
            'min_size': min_size,
            'max_size': max_size,
            'tag_mode': tag_mode,
            'include_missing': include_missing_flag,
            'include_descendants': include_descendants_flag
        }
    })

@api.route('/files/random', methods=['GET'])
def get_random_file():
    """
    Gets a single random file from the library.
    TODO: Add filtering capabilities based on tags, read status, etc.
    """
    query = File.query.filter_by(is_missing=False)
    random_file = query.order_by(func.random()).first()
    
    if random_file:
        return jsonify(file_to_dict(random_file))
    else:
        return jsonify({'error': 'No files in the library.'}), 404

def rename_file_based_on_tags(file_obj):
    """
    Renames a file based on its tags.
    """
    # First, remove all tags from the filename
    base_name = os.path.basename(file_obj.file_path)
    _, ext = os.path.splitext(base_name)
    
    # 移除文件名前缀标签，例如："[tag] file.zip" -> "file.zip"
    name_without_tags = re.sub(r'^(\[[^\]]+\]\s*)+', '', base_name).strip()
    # 避免出现类似 ".zip.zip" 的重复扩展名：这里只保留“去扩展名后的正文”
    name_without_tags, _ = os.path.splitext(name_without_tags)

    # Now, construct the new filename with the updated tags
    tags_string = "".join([f"[{tag.name}]" for tag in file_obj.tags])
    
    # Sanitize the final filename components
    sanitized_tags = sanitize_filename(tags_string)
    sanitized_name = sanitize_filename(name_without_tags)

    new_filename = f"{sanitized_tags}{sanitized_name}{ext}"
    
    # Construct the full new path
    directory = os.path.dirname(file_obj.file_path)
    new_path = os.path.join(directory, new_filename)

    # Rename the file if the path is different
    if new_path != file_obj.file_path:
        try:
            os.rename(file_obj.file_path, new_path)
            file_obj.file_path = new_path
            return True, None # Success
        except OSError as e:
            return False, str(e) # Failure
    
    return True, None # No change needed


@api.route('/files/<int:id>', methods=['GET', 'PUT'])
def handle_file_details(id):
    """Gets or updates a single file's details."""
    file_record = File.query.get_or_404(id)

    if request.method == 'GET':
        return jsonify(file_to_dict(file_record))

    if request.method == 'PUT':
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON'}), 400

        # Update tags if provided
        if 'tags' in data:
            try:
                tag_ids = [t['id'] for t in data['tags']]
                tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
                if len(tags) != len(tag_ids):
                    found_ids = {t.id for t in tags}
                    invalid_ids = [tid for tid in tag_ids if tid not in found_ids]
                    return jsonify({'error': f'Invalid tag IDs provided: {invalid_ids}'}), 400
                
                file_record.tags = tags
            except (KeyError, TypeError):
                 return jsonify({'error': 'Invalid format for tags. Expected a list of objects with an "id" key.'}), 400

        # Check if rename is requested
        if data.get('rename_file', False):
            success, error_msg = rename_file_based_on_tags(file_record)
            if not success:
                db.session.rollback() # Rollback tag changes if rename fails
                return jsonify({'error': f'Failed to rename file: {error_msg}'}), 500

        db.session.commit()
        
        # Return the updated record
        return jsonify(file_to_dict(file_record))

@api.route('/files/<int:id>/progress', methods=['POST'])
def update_reading_progress(id):
    """Updates the reading progress for a file."""
    file_record = db.session.get(File, id)
    if not file_record:
        return jsonify({'error': 'File not found'}), 404

    data = request.get_json()
    if data is None or 'page' not in data:
        return jsonify({'error': 'Missing page number in request'}), 400
    
    page = data['page']
    if not isinstance(page, int) or page < 0 or page >= file_record.total_pages:
        return jsonify({'error': 'Invalid page number'}), 400

    file_record.last_read_page = page
    file_record.last_read_date = db.func.now()

    if page == 0:
        file_record.reading_status = 'unread'
    elif page >= file_record.total_pages - 1:
        file_record.reading_status = 'finished'
    else:
        file_record.reading_status = 'in_progress'
        
    db.session.commit()
    return jsonify({'message': 'Progress updated successfully', 'status': file_record.reading_status})


@api.route('/files/bulk-tags', methods=['POST'])
def bulk_update_file_tags():
    """Bulk add/remove/set tags for multiple files.
    Body:
      - file_ids: [int, ...] (required)
      - set_tag_ids: [int, ...] (optional; if provided, overrides add/remove)
      - add_tag_ids: [int, ...] (optional)
      - remove_tag_ids: [int, ...] (optional)
    """
    payload = request.get_json() or {}
    file_ids = payload.get('file_ids') or []
    if not isinstance(file_ids, list) or not all(isinstance(x, int) for x in file_ids) or not file_ids:
        return jsonify({'error': 'file_ids must be a non-empty list of integers'}), 400

    set_ids = payload.get('set_tag_ids')
    add_ids = payload.get('add_tag_ids') or []
    remove_ids = payload.get('remove_tag_ids') or []

    # Validate IDs
    for name, ids in [('set_tag_ids', set_ids), ('add_tag_ids', add_ids), ('remove_tag_ids', remove_ids)]:
        if ids is None:
            continue
        if not isinstance(ids, list) or not all(isinstance(x, int) for x in ids):
            return jsonify({'error': f'{name} must be a list of integers'}), 400

    # Fetch files
    files = File.query.filter(File.id.in_(file_ids)).all()
    if len(files) != len(set(file_ids)):
        found_ids = {f.id for f in files}
        missing = [fid for fid in file_ids if fid not in found_ids]
        return jsonify({'error': f'Invalid file IDs: {missing}'}), 400

    # Determine tag set to apply
    updated = 0
    if set_ids is not None:
        # Replace tags for each file
        tags = Tag.query.filter(Tag.id.in_(set_ids)).all() if set_ids else []
        if len(tags) != len(set(set_ids)):
            found = {t.id for t in tags}
            invalid = [tid for tid in set_ids if tid not in found]
            return jsonify({'error': f'Invalid tag IDs in set_tag_ids: {invalid}'}), 400
        for f in files:
            f.tags = tags
            updated += 1
    else:
        add_tags = Tag.query.filter(Tag.id.in_(add_ids)).all() if add_ids else []
        if add_ids and len(add_tags) != len(set(add_ids)):
            found = {t.id for t in add_tags}
            invalid = [tid for tid in add_ids if tid not in found]
            return jsonify({'error': f'Invalid tag IDs in add_tag_ids: {invalid}'}), 400
        remove_tags = Tag.query.filter(Tag.id.in_(remove_ids)).all() if remove_ids else []
        if remove_ids and len(remove_tags) != len(set(remove_ids)):
            found = {t.id for t in remove_tags}
            invalid = [tid for tid in remove_ids if tid not in found]
            return jsonify({'error': f'Invalid tag IDs in remove_tag_ids: {invalid}'}), 400
        add_by_id = {t.id: t for t in add_tags}
        remove_ids_set = {t.id for t in remove_tags}
        for f in files:
            # Add
            for tid, t in add_by_id.items():
                if tid not in [et.id for et in f.tags]:
                    f.tags.append(t)
            # Remove
            f.tags = [t for t in f.tags if t.id not in remove_ids_set]
            updated += 1

    db.session.commit()
    return jsonify({'updated_files': updated})


@api.route('/files/<int:id>/status', methods=['POST'])
def update_reading_status(id):
    """Manually updates the reading status for a file."""
    file_record = db.session.get(File, id)
    if not file_record:
        return jsonify({'error': 'File not found'}), 404

    data = request.get_json() or {}
    status = data.get('status')
    if not status:
        return jsonify({'error': 'Missing status value'}), 400

    status = status.lower()
    if status not in READING_STATUS_OPTIONS:
        return jsonify({'error': f'Invalid status value "{status}".'}), 400

    requested_page = data.get('page')
    new_page = None
    if isinstance(requested_page, int):
        new_page = max(0, requested_page)
        if file_record.total_pages:
            new_page = min(new_page, max(0, file_record.total_pages - 1))

    if status == 'unread':
        file_record.last_read_page = 0
        file_record.last_read_date = None
    elif status == 'finished':
        if file_record.total_pages:
            file_record.last_read_page = max(0, file_record.total_pages - 1)
        elif new_page is not None:
            file_record.last_read_page = new_page
        file_record.last_read_date = db.func.now()
    else:  # in_progress
        if new_page is not None:
            file_record.last_read_page = new_page
        file_record.last_read_date = db.func.now()

    file_record.reading_status = status
    db.session.commit()

    return jsonify(file_to_dict(file_record))

@api.route('/files/<int:id>/page/<int:page_num>', methods=['GET'])
def get_file_page(id, page_num):
    """
    Streams a single page image from a file.
    Page numbers are 0-indexed.
    """
    file_record = db.session.get(File, id)
    if not file_record or file_record.is_missing:
        return jsonify({'error': 'File not found'}), 404
    
    if page_num < 0 or page_num >= file_record.total_pages:
        return jsonify({'error': 'Page number out of range'}), 400

    response = build_page_response(file_record.file_path, page_num)
    if response:
        return response

    return jsonify({'error': 'Failed to extract page from archive'}), 500

@api.route('/files/<int:id>/page/<int:page_num>/details', methods=['GET'])
def get_file_page_details(id, page_num):
    """
    Gets metadata for a specific page of a file, including manga and page details.
    """
    file_record = db.session.get(File, id)
    if not file_record or file_record.is_missing:
        return jsonify({'error': 'File not found'}), 404
    
    if page_num < 0 or page_num >= file_record.total_pages:
        return jsonify({'error': 'Page number out of range'}), 400

    page_filename, page_filesize = get_page_details_from_archive(file_record.file_path, page_num)
    
    if page_filename is not None:
        manga_filename = os.path.basename(file_record.file_path)
        
        return jsonify({
            'manga_filename': manga_filename,
            'manga_filesize': file_record.file_size,
            'page_filename': page_filename,
            'page_filesize': page_filesize,
        })
    else:
        return jsonify({'error': 'Failed to extract page details from archive'}), 500


@api.route('/files/stats', methods=['GET'])
def get_file_library_stats():
    """
    Returns aggregate statistics for the manga library along with handy highlights.
    """
    base_filter = File.is_missing.is_(False)

    total_items = db.session.query(func.count(File.id)).filter(base_filter).scalar() or 0

    status_rows = (
        db.session.query(File.reading_status, func.count(File.id))
        .filter(base_filter)
        .group_by(File.reading_status)
        .all()
    )
    status_counts = {status: 0 for status in READING_STATUS_OPTIONS}
    for row_status, row_count in status_rows:
        status_counts[row_status or 'unread'] = row_count

    liked_count = db.session.query(func.count(File.id)).filter(base_filter, File.like_item.has()).scalar() or 0

    total_page_sum = db.session.query(func.coalesce(func.sum(File.total_pages), 0)).filter(base_filter).scalar() or 0
    total_size_sum = db.session.query(func.coalesce(func.sum(File.file_size), 0)).filter(base_filter).scalar() or 0
    average_page_count = float(total_page_sum) / total_items if total_items else 0

    # Highlights
    highlight_query = File.query.options(
        selectinload(File.tags),
        selectinload(File.like_item)
    ).filter(base_filter)

    recently_added = highlight_query.order_by(File.add_date.desc()).limit(6).all()
    recently_read = (
        highlight_query.filter(File.last_read_date.isnot(None))
        .order_by(File.last_read_date.desc())
        .limit(6)
        .all()
    )
    largest_files = highlight_query.order_by(func.coalesce(File.file_size, 0).desc()).limit(6).all()

    top_tags = (
        db.session.query(
            Tag.id,
            Tag.name,
            func.count(File.id).label('usage_count')
        )
        .join(Tag.files)
        .filter(base_filter)
        .group_by(Tag.id, Tag.name)
        .order_by(func.count(File.id).desc(), Tag.name.asc())
        .limit(12)
        .all()
    )

    return jsonify({
        'totals': {
            'items': total_items,
            'pages': total_page_sum,
            'file_size_bytes': total_size_sum,
            'liked_items': liked_count,
            'average_pages': round(average_page_count, 2)
        },
        'status_counts': status_counts,
        'highlights': {
            'recently_added': [file_to_dict(f) for f in recently_added],
            'recently_read': [file_to_dict(f) for f in recently_read],
            'largest_files': [file_to_dict(f) for f in largest_files]
        },
        'top_tags': [
            {
                'id': tag_id,
                'name': tag_name,
                'usage_count': usage_count
            }
            for tag_id, tag_name, usage_count in top_tags
        ]
    })
