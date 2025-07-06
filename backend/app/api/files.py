from flask import jsonify, request, send_file
from . import api
from ..models import File, Tag
from .. import db
import os
import zipfile
import rarfile
import py7zr
import io
from sqlalchemy.sql.expression import func

def file_to_dict(file_obj):
    """Converts a File object to a dictionary."""
    return {
        'id': file_obj.id,
        'file_path': file_obj.file_path,
        'file_hash': file_obj.file_hash,
        'file_size': file_obj.file_size,
        'add_date': file_obj.add_date.isoformat(),
        'total_pages': file_obj.total_pages,
        'spread_pages': file_obj.spread_pages,
        'last_read_page': file_obj.last_read_page,
        'last_read_date': file_obj.last_read_date.isoformat() if file_obj.last_read_date else None,
        'reading_status': file_obj.reading_status,
        'is_missing': file_obj.is_missing,
        'integrity_status': file_obj.integrity_status,
        'cover_url': f'/api/v1/covers/{file_obj.file_hash}.webp',
        'tags': [{'id': t.id, 'name': t.name} for t in file_obj.tags]
    }

def get_image_from_archive(file_path, page_num):
    """
    Extracts a single image from a compressed archive without full decompression.
    Returns the image data as a BytesIO stream and the mimetype.
    """
    IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext in ['.zip', '.cbz']:
            with zipfile.ZipFile(file_path, 'r') as archive:
                image_list = sorted([name for name in archive.namelist() if any(name.lower().endswith(img_ext) for img_ext in IMAGE_EXTENSIONS) and not name.startswith('__MACOSX')])
                if 0 <= page_num < len(image_list):
                    image_name = image_list[page_num]
                    mimetype = f'image/{os.path.splitext(image_name)[1].lower().replace(".", "")}'
                    return io.BytesIO(archive.read(image_name)), mimetype
        
        elif ext in ['.rar', '.cbr']:
            with rarfile.RarFile(file_path, 'r') as archive:
                image_list = sorted([info.filename for info in archive.infolist() if any(info.filename.lower().endswith(img_ext) for img_ext in IMAGE_EXTENSIONS) and not info.isdir()])
                if 0 <= page_num < len(image_list):
                    image_name = image_list[page_num]
                    mimetype = f'image/{os.path.splitext(image_name)[1].lower().replace(".", "")}'
                    return io.BytesIO(archive.read(image_name)), mimetype

        elif ext in ['.7z', '.cb7']:
            with py7zr.SevenZipFile(file_path, 'r') as archive:
                all_files = archive.readall()
                image_list = sorted([name for name, bio in all_files.items() if any(name.lower().endswith(img_ext) for img_ext in IMAGE_EXTENSIONS) and not bio.get('is_directory')])
                if 0 <= page_num < len(image_list):
                    image_name = image_list[page_num]
                    mimetype = f'image/{os.path.splitext(image_name)[1].lower().replace(".", "")}'
                    # The content is already a BytesIO-like object in py7zr's case
                    return all_files[image_name], mimetype

    except Exception:
        # Log the exception here
        return None, None
    return None, None

@api.route('/files', methods=['GET'])
def get_files():
    """
    Get a paginated list of files with optional sorting and filtering.
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    sort_by = request.args.get('sort_by', 'add_date')
    sort_order = request.args.get('sort_order', 'desc')
    is_missing_str = request.args.get('is_missing')
    tag_ids_str = request.args.get('tags')

    # Basic query
    query = File.query

    # Filtering
    if tag_ids_str:
        try:
            tag_ids = [int(tid) for tid in tag_ids_str.split(',') if tid]
            if tag_ids:
                # Use a simple JOIN and IN to filter for files that have ANY of the selected tags (OR condition)
                query = query.join(File.tags).filter(Tag.id.in_(tag_ids))
        except ValueError:
            return jsonify({'error': 'Invalid tag IDs provided'}), 400

    if is_missing_str is not None:
        is_missing = is_missing_str.lower() in ['true', '1', 'yes']
        query = query.filter(File.is_missing == is_missing)
    else:
        # Default to not showing missing files unless explicitly requested
        query = query.filter(File.is_missing == False)

    # Sorting
    if hasattr(File, sort_by):
        column = getattr(File, sort_by)
        if sort_order == 'desc':
            query = query.order_by(column.desc())
        else:
            query = query.order_by(column.asc())

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

@api.route('/files/<int:id>', methods=['GET'])
def get_file_details(id):
    """Gets a single file's details by its ID."""
    file_record = db.session.get(File, id)
    if not file_record or file_record.is_missing:
        return jsonify({'error': 'File not found'}), 404
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

    image_stream, mimetype = get_image_from_archive(file_record.file_path, page_num)
    
    if image_stream and mimetype:
        return send_file(image_stream, mimetype=mimetype)
    else:
        return jsonify({'error': 'Failed to extract page from archive'}), 500 