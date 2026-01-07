from flask import abort, current_app, jsonify, request, Response, send_file, stream_with_context
from . import api
from ...models import File, Tag
from ... import db
import io
import os
import re
import hashlib
from loguru import logger
from PIL import Image, ImageOps
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.expression import func
from ...infrastructure.archive_reader import (
    get_entry_by_index,
    get_entry_metadata as get_cached_entry_metadata,
    guess_mimetype,
    iter_entry_chunks,
    read_entry_stream,
)
from ...services.cover_service import CoverPathConfig, get_cover_path
from ...services.settings_service import get_bool_setting, get_cover_cache_shard_count, get_int_setting, get_str_setting
from ...tasks.rename import rename_single_file_inplace, sanitize_filename
from ...services.task_service import create_task_record, fail_task, finish_task, mark_task_running, update_task_progress
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
    """将 File 对象转换为前端使用的字典。"""
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
        'file_size': file_obj.file_size,
        'file_mtime': file_obj.file_mtime,
        'cover_updated_at': file_obj.cover_updated_at,
        'content_sha256': file_obj.content_sha256,
        'add_date': file_obj.add_date.isoformat() if file_obj.add_date else None,
        'total_pages': file_obj.total_pages,
        'last_read_page': file_obj.last_read_page,
        'last_read_date': file_obj.last_read_date.isoformat() if file_obj.last_read_date else None,
        'reading_status': file_obj.reading_status,
        'progress_percent': progress_percent,
        'is_missing': file_obj.is_missing,
        'integrity_status': file_obj.integrity_status,
        'cover_url': f'/api/v1/files/{file_obj.id}/cover?v={file_obj.cover_updated_at or file_obj.file_mtime}',
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
    按页返回图片。

    - 默认：流式输出原图，避免整本或整页一次性堆入内存。
    - 可选：根据参数对页面做缩放渲染（用于降低加载成本/缓解摩尔纹）。
    """
    entry = get_entry_by_index(file_path, page_num)
    if entry is None:
        return None

    # 说明：前端会把设置拼到查询参数里，确保“切换分辨率/质量”可以立刻刷新当前页。
    # 未传参数时仍保持老行为（原图流式输出）。
    max_side_px_raw = request.args.get('max_side_px')
    format_raw = request.args.get('format')
    quality_raw = request.args.get('quality')
    resample_raw = request.args.get('resample')

    default_max_side_px = get_int_setting('ui.reader.image.max_side_px', default=0, min_value=0, max_value=20000)
    default_format = get_str_setting('ui.reader.image.render.format', default='webp')
    default_quality = get_int_setting('ui.reader.image.render.quality', default=82, min_value=1, max_value=100)
    default_resample = get_str_setting('ui.reader.image.render.resample', default='bilinear')
    default_optimize = get_bool_setting('ui.reader.image.render.optimize', default=False)
    default_webp_method = get_int_setting('ui.reader.image.render.webp_method', default=0, min_value=0, max_value=6)

    cache_enabled = get_bool_setting('ui.reader.image.cache.enabled', default=True)
    cache_max_age_s = get_int_setting('ui.reader.image.cache.max_age_s', default=31536000, min_value=0, max_value=31536000)
    cache_immutable = get_bool_setting('ui.reader.image.cache.immutable', default=True)

    def parse_int(raw_value):
        if raw_value is None or raw_value == '':
            return None
        try:
            return int(str(raw_value).strip())
        except ValueError:
            return None

    max_side_px = parse_int(max_side_px_raw)
    if max_side_px is None:
        max_side_px = default_max_side_px
    max_side_px = max(0, min(20000, int(max_side_px)))

    output_format = str(format_raw or default_format or 'webp').strip().lower()
    quality = parse_int(quality_raw)
    if quality is None:
        quality = default_quality
    quality = max(1, min(100, int(quality)))

    resample_name = str(resample_raw or default_resample or 'lanczos').strip().lower()

    optimize = parse_bool(request.args.get('optimize'))
    if optimize is None:
        optimize = default_optimize

    webp_method = parse_int(request.args.get('webp_method'))
    if webp_method is None:
        webp_method = default_webp_method
    webp_method = max(0, min(6, int(webp_method)))

    # ETag：基于文件签名 + 页码 + 渲染参数，避免重复缩放/解压。
    # - 即使开启 immutable 缓存，该 ETag 也可用于更保守的缓存策略（或调试）。
    try:
        stat = os.stat(file_path)
        file_sig = f'{int(stat.st_mtime)}-{int(stat.st_size)}'
    except Exception:
        file_sig = '0-0'

    etag_source = '|'.join(
        [
            file_sig,
            str(page_num),
            str(entry.name or ''),
            str(entry.size or ''),
            str(max_side_px),
            str(output_format),
            str(quality),
            str(resample_name),
            str(int(optimize)),
            str(webp_method),
        ]
    )
    etag_value = f'W/"{hashlib.sha1(etag_source.encode("utf-8")).hexdigest()}"'
    if request.headers.get('If-None-Match') == etag_value:
        response = Response(status=304)
        response.headers['ETag'] = etag_value
        if cache_enabled and cache_max_age_s > 0:
            response.headers['Cache-Control'] = f'private, max-age={cache_max_age_s}{", immutable" if cache_immutable else ""}'
        else:
            response.headers['Cache-Control'] = 'no-store'
        return response

    if max_side_px > 0:
        rendered = render_page_image(
            file_path,
            entry,
            max_side_px=max_side_px,
            output_format=output_format,
            quality=quality,
            resample=resample_name,
            optimize=optimize,
            webp_method=webp_method,
        )
        if rendered is not None:
            data, mimetype = rendered
            response = Response(data, mimetype=mimetype, direct_passthrough=True)
            response.headers['Content-Length'] = str(len(data))
            response.headers['ETag'] = etag_value
            if cache_enabled and cache_max_age_s > 0:
                response.headers['Cache-Control'] = f'private, max-age={cache_max_age_s}{", immutable" if cache_immutable else ""}'
            else:
                response.headers['Cache-Control'] = 'no-store'
            return response

    mimetype = guess_mimetype(entry.name)
    content_length = entry.size
    chunk_kb = get_int_setting('reader.stream.chunk_kb', default=512, min_value=64, max_value=4096)
    chunk_size = chunk_kb * 1024

    def generate():
        yield from iter_entry_chunks(file_path, entry, chunk_size=chunk_size)

    response = Response(stream_with_context(generate()), mimetype=mimetype, direct_passthrough=True)
    if content_length:
        response.headers['Content-Length'] = str(content_length)
    response.headers['ETag'] = etag_value
    if cache_enabled and cache_max_age_s > 0:
        response.headers['Cache-Control'] = f'private, max-age={cache_max_age_s}{", immutable" if cache_immutable else ""}'
    else:
        response.headers['Cache-Control'] = 'no-store'
    return response


def render_page_image(file_path, entry, *, max_side_px: int, output_format: str, quality: int, resample: str, optimize: bool, webp_method: int):
    """
    将页面图片缩放后再返回（用于降低传输与渲染压力）。

    返回： (bytes, mimetype) 或 None（表示回退到原图流式输出）。
    """
    if max_side_px <= 0:
        return None

    stream = read_entry_stream(file_path, entry)
    if stream is None:
        return None

    resampling = getattr(Image, 'Resampling', Image)
    resample_map = {
        'nearest': resampling.NEAREST,
        'bilinear': resampling.BILINEAR,
        'bicubic': resampling.BICUBIC,
        'lanczos': resampling.LANCZOS,
    }
    resample_filter = resample_map.get(str(resample or '').strip().lower(), resampling.LANCZOS)

    def normalize_output_format(value: str, original: str | None) -> str:
        v = str(value or '').strip().lower()
        if v in {'jpg', 'jpeg'}:
            return 'JPEG'
        if v == 'png':
            return 'PNG'
        if v == 'webp':
            return 'WEBP'
        if v in {'auto', '', 'origin', 'original'}:
            if original and str(original).upper() in {'JPEG', 'PNG', 'WEBP'}:
                return str(original).upper()
            return 'WEBP'
        return 'WEBP'

    def mimetype_for_format(fmt: str) -> str:
        fmt = str(fmt or '').upper()
        if fmt == 'PNG':
            return 'image/png'
        if fmt == 'WEBP':
            return 'image/webp'
        return 'image/jpeg'

    def prepare_for_jpeg(image: Image.Image) -> Image.Image:
        if image.mode == 'RGB' or image.mode == 'L':
            return image
        if image.mode in {'RGBA', 'LA'}:
            background = Image.new('RGB', image.size, (255, 255, 255))
            alpha = image.split()[-1]
            background.paste(image, mask=alpha)
            return background
        if image.mode == 'P':
            rgba = image.convert('RGBA')
            background = Image.new('RGB', rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.split()[-1])
            return background
        return image.convert('RGB')

    try:
        stream.seek(0)
        with Image.open(stream) as img:
            # JPEG 可以使用 draft 降低解码分辨率，避免超大图完整解码带来的卡顿。
            try:
                if getattr(img, 'format', None) == 'JPEG':
                    img.draft('RGB', (max_side_px, max_side_px))
            except Exception:
                pass

            # 修正可能存在的 EXIF 旋转信息，避免缩放后方向错误。
            img = ImageOps.exif_transpose(img)

            if max(img.width, img.height) <= max_side_px:
                return None

            fmt = normalize_output_format(output_format, getattr(img, 'format', None))
            img.thumbnail((max_side_px, max_side_px), resample=resample_filter)

            out = io.BytesIO()
            save_kwargs = {}
            if fmt == 'JPEG':
                save_kwargs = {'quality': int(quality), 'optimize': bool(optimize)}
            elif fmt == 'WEBP':
                save_kwargs = {'quality': int(quality), 'method': int(webp_method)}
            elif fmt == 'PNG':
                save_kwargs = {'optimize': bool(optimize)}

            image_to_save = img
            if fmt == 'JPEG':
                image_to_save = prepare_for_jpeg(img)

            image_to_save.save(out, format=fmt, **save_kwargs)
            return out.getvalue(), mimetype_for_format(fmt)
    except Exception as exc:
        logger.warning('渲染缩放页面失败: {} | 条目: {} | 错误: {}', file_path, getattr(entry, 'name', ''), exc)
        return None


def parse_int_list(raw_value):
    """解析逗号分隔的整数列表。"""
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
            raise ValueError(f'无效的整数值："{item}"')
    return result


def parse_bool(raw_value):
    """解析“类布尔值”字符串；返回 True/False，无法判断时返回 None。"""
    if raw_value is None:
        return None
    if isinstance(raw_value, bool):
        return raw_value
    value = str(raw_value).strip().lower()
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
    获取文件分页列表（支持排序与筛选）。
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
        return jsonify({'error': 'tag_mode 必须为 "any" 或 "all"'}), 400

    statuses = []
    if status_param:
        statuses = [
            status.strip().lower()
            for status in status_param.split(',')
            if status.strip()
        ]
        invalid_statuses = [status for status in statuses if status not in READING_STATUS_OPTIONS]
        if invalid_statuses:
            return jsonify({'error': f'无效的阅读状态：{invalid_statuses}'}), 400

    liked_flag = parse_bool(liked_param)
    include_missing_flag = parse_bool(include_missing_param)
    include_descendants_flag = parse_bool(include_descendants_param)

    # 基础查询
    query = File.query.options(
        selectinload(File.tags),
        selectinload(File.like_item)
    )

    # 筛选
    if keyword:
        for token in keyword.split():
            token_like = f'%{token}%'
            query = query.filter(File.file_path.ilike(token_like))

    # 可选：将标签筛选扩展为包含后代标签
    def expand_with_descendants(ids):
        if not ids:
            return []
        # 一次性构建 parent -> children 映射
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
            return jsonify({'error': 'is_missing 必须为布尔值'}), 400
        query = query.filter(File.is_missing == is_missing_flag)
    else:
        # Default to not showing missing files unless explicitly requested or include_missing is true
        if include_missing_flag is not True:
            query = query.filter(File.is_missing.is_(False))

    # 排序
    if sort_by == 'random':
        query = query.order_by(func.random())
    else:
        sort_factory = SORTABLE_COLUMNS.get(sort_by)
        if sort_factory is None:
            return jsonify({'error': f'不支持的 sort_by："{sort_by}"'}), 400
        sort_column = sort_factory()
        if sort_order == 'asc':
            query = query.order_by(sort_column.asc(), File.id.asc())
        else:
            query = query.order_by(sort_column.desc(), File.id.desc())

    # 分页
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

def rename_file_based_on_tags(file_obj):
    """
    基于文件标签重命名文件（同步）。
    """
    # 先移除文件名前缀标签，例如："[tag] file.zip" -> "file.zip"
    base_name = os.path.basename(file_obj.file_path)
    _, ext = os.path.splitext(base_name)
    
    name_without_tags = re.sub(r'^(\[[^\]]+\]\s*)+', '', base_name).strip()
    # 避免出现类似 ".zip.zip" 的重复扩展名：这里只保留“去扩展名后的正文”
    name_without_tags, _ = os.path.splitext(name_without_tags)

    # 重新构造“标签前缀 + 文件正文 + 扩展名”
    tags_string = "".join([f"[{tag.name}]" for tag in file_obj.tags])
    
    # 清理非法字符
    sanitized_tags = sanitize_filename(tags_string)
    sanitized_name = sanitize_filename(name_without_tags)

    new_filename = f"{sanitized_tags}{sanitized_name}{ext}"
    
    # 生成新路径
    directory = os.path.dirname(file_obj.file_path)
    new_path = os.path.join(directory, new_filename)

    # 执行重命名
    if new_path != file_obj.file_path:
        try:
            os.rename(file_obj.file_path, new_path)
            file_obj.file_path = new_path
            return True, None  # 成功
        except OSError as e:
            return False, str(e)  # 失败
    
    return True, None  # 无需变更


@api.route('/files/<int:id>', methods=['GET', 'PUT', 'PATCH'])
def handle_file_details(id):
    """获取/更新单个文件详情。"""
    file_record = File.query.get_or_404(id)

    if request.method == 'GET':
        return jsonify(file_to_dict(file_record))

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': '请求体必须为 JSON'}), 400

    if request.method == 'PUT':
        # 更新 tags（编辑页会用到）
        if 'tags' in data:
            try:
                tag_ids = [int(t['id']) for t in data['tags']]
                tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
                if len(tags) != len(tag_ids):
                    found_ids = {t.id for t in tags}
                    invalid_ids = [tid for tid in tag_ids if tid not in found_ids]
                    return jsonify({'error': f'无效的标签 ID：{invalid_ids}'}), 400

                file_record.tags = tags
            except (KeyError, TypeError, ValueError):
                return jsonify({'error': 'tags 格式错误，期望为包含 id 的对象数组'}), 400

        # 可选：基于 tags 自动重命名（历史功能）
        if data.get('rename_file', False):
            success, error_msg = rename_file_based_on_tags(file_record)
            if not success:
                db.session.rollback()  # 重命名失败时回滚 tags 变更
                return jsonify({'error': f'重命名失败：{error_msg}'}), 500

        db.session.commit()
        return jsonify(file_to_dict(file_record))

    # PATCH：局部更新（阅读进度/状态、单文件重命名）
    db_task_id = None

    if (
        'new_filename' not in data
        and 'reading_status' not in data
        and 'status' not in data
        and 'last_read_page' not in data
        and 'page' not in data
    ):
        return jsonify({'error': '未提供可更新字段'}), 400

    # 1) 单文件重命名（同步执行，但写入任务记录）
    if 'new_filename' in data:
        new_filename = data.get('new_filename')
        if not isinstance(new_filename, str) or not new_filename.strip():
            return jsonify({'error': 'new_filename 必须为非空字符串'}), 400

        old_path = str(file_record.file_path or '')
        old_name = os.path.basename(old_path) if old_path else str(id)

        task_record = create_task_record(
            name=f'重命名文件: {old_name}',
            task_type='rename',
            status='pending',
            target_path=old_path,
            total_files=1,
            processed_files=0,
            progress=0.0,
            current_file=old_name,
        )
        mark_task_running(task_record, current_file=old_name, total_files=1, processed_files=0, target_path=old_path)

        try:
            rename_single_file_inplace(file_record, new_filename.strip())
            db.session.commit()
            new_name = os.path.basename(str(file_record.file_path or '')) or old_name
            update_task_progress(task_record, processed_files=1, total_files=1, current_file=new_name)
            finish_task(task_record, status='completed')
            db_task_id = task_record.id
        except ValueError as exc:
            db.session.rollback()
            fail_task(task_record, error_message=str(exc))
            return jsonify({'error': str(exc), 'db_task_id': task_record.id}), 400
        except Exception as exc:
            db.session.rollback()
            fail_task(task_record, error_message=f'重命名失败：{exc}')
            return jsonify({'error': f'重命名失败：{exc}', 'db_task_id': task_record.id}), 500

    # 2) 阅读进度/状态（不写任务记录）
    requested_status = data.get('reading_status')
    if requested_status is None and 'status' in data:
        requested_status = data.get('status')

    requested_page = data.get('last_read_page')
    if requested_page is None and 'page' in data:
        requested_page = data.get('page')

    if requested_status is not None:
        status = str(requested_status).strip().lower()
        if status not in READING_STATUS_OPTIONS:
            return jsonify({'error': f'无效的阅读状态："{status}"'}), 400

        page = None
        if requested_page is not None:
            if not isinstance(requested_page, int) or requested_page < 0:
                return jsonify({'error': 'last_read_page 必须为非负整数'}), 400
            if file_record.total_pages and requested_page >= int(file_record.total_pages):
                return jsonify({'error': 'last_read_page 超出范围'}), 400
            page = int(requested_page)

        if status == 'unread':
            file_record.reading_status = 'unread'
            file_record.last_read_page = 0
            file_record.last_read_date = None
        elif status == 'finished':
            if file_record.total_pages:
                file_record.last_read_page = max(0, int(file_record.total_pages) - 1)
            elif page is not None:
                file_record.last_read_page = page
            file_record.last_read_date = db.func.now()
            file_record.reading_status = 'finished'
        else:  # in_progress
            if page is not None:
                file_record.last_read_page = page
            file_record.last_read_date = db.func.now()
            # 若总页数已知且已经到末页，则自动归为 finished
            if file_record.total_pages and int(file_record.last_read_page or 0) >= int(file_record.total_pages) - 1:
                file_record.reading_status = 'finished'
            else:
                file_record.reading_status = 'in_progress'

        db.session.commit()
    elif requested_page is not None:
        if not isinstance(requested_page, int) or requested_page < 0:
            return jsonify({'error': 'last_read_page 必须为非负整数'}), 400
        if file_record.total_pages and requested_page >= int(file_record.total_pages):
            return jsonify({'error': 'last_read_page 超出范围'}), 400

        file_record.last_read_page = int(requested_page)
        file_record.last_read_date = db.func.now()
        if file_record.total_pages and file_record.last_read_page >= int(file_record.total_pages) - 1:
            file_record.reading_status = 'finished'
        else:
            file_record.reading_status = 'in_progress'
        db.session.commit()

    result = file_to_dict(file_record)
    if db_task_id is not None:
        result['db_task_id'] = db_task_id
    return jsonify(result)


@api.route('/file-tag-batches', methods=['POST'])
def bulk_update_file_tags():
    """批量为多个文件增删/覆盖标签。

    请求体：
    - file_ids: [int, ...]（必填）
    - set_tag_ids: [int, ...]（可选，若提供则覆盖 add/remove）
    - add_tag_ids: [int, ...]（可选）
    - remove_tag_ids: [int, ...]（可选）
    """
    payload = request.get_json() or {}
    file_ids = payload.get('file_ids') or []
    if not isinstance(file_ids, list) or not all(isinstance(x, int) for x in file_ids) or not file_ids:
        return jsonify({'error': 'file_ids 必须为非空整数数组'}), 400

    set_ids = payload.get('set_tag_ids')
    add_ids = payload.get('add_tag_ids') or []
    remove_ids = payload.get('remove_tag_ids') or []

    # Validate IDs
    for name, ids in [('set_tag_ids', set_ids), ('add_tag_ids', add_ids), ('remove_tag_ids', remove_ids)]:
        if ids is None:
            continue
        if not isinstance(ids, list) or not all(isinstance(x, int) for x in ids):
            return jsonify({'error': f'{name} 必须为整数数组'}), 400

    # Fetch files
    files = File.query.filter(File.id.in_(file_ids)).all()
    if len(files) != len(set(file_ids)):
        found_ids = {f.id for f in files}
        missing = [fid for fid in file_ids if fid not in found_ids]
        return jsonify({'error': f'无效的文件 ID：{missing}'}), 400

    task_record = create_task_record(
        name=f'批量修改文件标签（{len(file_ids)} 个文件）',
        task_type='bulk_tags',
        status='pending',
        total_files=len(file_ids),
        processed_files=0,
        progress=0.0,
        current_file='准备中...',
    )

    # Determine tag set to apply
    updated = 0
    if set_ids is not None:
        # Replace tags for each file
        tags = Tag.query.filter(Tag.id.in_(set_ids)).all() if set_ids else []
        if len(tags) != len(set(set_ids)):
            found = {t.id for t in tags}
            invalid = [tid for tid in set_ids if tid not in found]
            return jsonify({'error': f'set_tag_ids 中存在无效的标签 ID：{invalid}'}), 400
        mark_task_running(task_record, current_file='批量设置标签...', total_files=len(files), processed_files=0)
        for f in files:
            f.tags = tags
            updated += 1
            if updated % 50 == 0 or updated == len(files):
                update_task_progress(
                    task_record,
                    processed_files=updated,
                    total_files=len(files),
                    current_file=str(f.file_path or ''),
                )
    else:
        add_tags = Tag.query.filter(Tag.id.in_(add_ids)).all() if add_ids else []
        if add_ids and len(add_tags) != len(set(add_ids)):
            found = {t.id for t in add_tags}
            invalid = [tid for tid in add_ids if tid not in found]
            return jsonify({'error': f'add_tag_ids 中存在无效的标签 ID：{invalid}'}), 400
        remove_tags = Tag.query.filter(Tag.id.in_(remove_ids)).all() if remove_ids else []
        if remove_ids and len(remove_tags) != len(set(remove_ids)):
            found = {t.id for t in remove_tags}
            invalid = [tid for tid in remove_ids if tid not in found]
            return jsonify({'error': f'remove_tag_ids 中存在无效的标签 ID：{invalid}'}), 400
        add_by_id = {t.id: t for t in add_tags}
        remove_ids_set = {t.id for t in remove_tags}
        mark_task_running(task_record, current_file='批量增删标签...', total_files=len(files), processed_files=0)
        for f in files:
            # Add
            for tid, t in add_by_id.items():
                if tid not in [et.id for et in f.tags]:
                    f.tags.append(t)
            # Remove
            f.tags = [t for t in f.tags if t.id not in remove_ids_set]
            updated += 1
            if updated % 50 == 0 or updated == len(files):
                update_task_progress(
                    task_record,
                    processed_files=updated,
                    total_files=len(files),
                    current_file=str(f.file_path or ''),
                )

    try:
        db.session.commit()
        update_task_progress(task_record, processed_files=updated, total_files=len(files), current_file='')
        finish_task(task_record, status='completed')
        return jsonify({'updated_files': updated, 'db_task_id': task_record.id})
    except Exception as exc:
        db.session.rollback()
        fail_task(task_record, error_message=f'批量修改标签失败: {str(exc)}')
        return jsonify({'error': f'批量修改标签失败: {str(exc)}', 'db_task_id': task_record.id}), 500


@api.route('/files/<int:id>/pages/<int:page_num>', methods=['GET'])
def get_file_page(id, page_num):
    """
    按页流式返回图片内容（页码从 0 开始）。
    """
    file_record = db.session.get(File, id)
    if not file_record or file_record.is_missing:
        return jsonify({'error': '文件不存在'}), 404
    
    if page_num < 0 or page_num >= file_record.total_pages:
        return jsonify({'error': '页码超出范围'}), 400

    response = build_page_response(file_record.file_path, page_num)
    if response:
        return response

    return jsonify({'error': '从压缩包读取页面失败'}), 500

@api.route('/files/<int:id>/pages/<int:page_num>/metadata', methods=['GET'])
def get_file_page_details(id, page_num):
    """
    获取指定页的元数据（文件名、大小等）。
    """
    file_record = db.session.get(File, id)
    if not file_record or file_record.is_missing:
        return jsonify({'error': '文件不存在'}), 404
    
    if page_num < 0 or page_num >= file_record.total_pages:
        return jsonify({'error': '页码超出范围'}), 400

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
        return jsonify({'error': '从压缩包读取页面元数据失败'}), 500


@api.route('/files/<int:id>/cover', methods=['GET'])
def get_file_cover(id):
    """返回指定文件的封面图片（WebP）。"""
    file_record = db.session.get(File, id)
    if not file_record or file_record.is_missing:
        return jsonify({'error': '文件不存在'}), 404

    cover_base_dir = current_app.config['COVER_CACHE_PATH']
    shard_count = get_cover_cache_shard_count()
    cover_path = get_cover_path(CoverPathConfig(base_dir=cover_base_dir, shard_count=shard_count), file_record.id)

    if not os.path.exists(cover_path):
        abort(404)

    response = send_file(cover_path, mimetype='image/webp', conditional=True)
    # URL 已带 v=file_mtime，可视作不可变资源，允许强缓存
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response


@api.route('/stats/files', methods=['GET'])
def get_file_library_stats():
    """
    返回漫画库统计信息（总量、阅读状态、喜欢、Top 标签等）。
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

    # 亮点卡片（用于首页）
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
