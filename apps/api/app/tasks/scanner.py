import os
import json
import hashlib
import multiprocessing
import re
import datetime
from PIL import Image
from flask import current_app
from loguru import logger

from .. import huey, db, socketio
from ..models.manga import File, Tag
from .. import create_app
from ..services.settings_service import get_scan_settings, ScanSettings
from ..infrastructure.archive_reader import (
    SUPPORTED_ARCHIVE_EXTENSIONS,
    get_archive_entries,
    read_entry_stream,
)

COVER_FILENAMES = ['cover', '000', '0000', '封面']


def get_sha256_hash(file_path):
    """计算文件 SHA-256，用于唯一标识。"""
    sha256 = hashlib.sha256()
    try:
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()
    except IOError as exc:
        error_msg = f'无法读取文件: {file_path}'
        socketio.emit('scan_error', {'error': error_msg})
        logger.error('{} | 错误: {}', error_msg, exc)
        return None


def analyze_archive(file_path, cover_cache_path, scan_settings: ScanSettings):
    """
    扫描压缩包，按需解压获取页数、跨页信息与封面候选，避免整本加载。
    """
    try:
        entries = get_archive_entries(file_path)
    except Exception as exc:
        error_msg = f'解析压缩包目录失败: {os.path.basename(file_path)} | 错误: {exc}'
        socketio.emit('scan_error', {'error': error_msg})
        logger.error(error_msg)
        return None

    spread_pages = []
    cover_candidates = []

    for index, entry in enumerate(entries):
        stream = read_entry_stream(file_path, entry)
        if stream is None:
            logger.warning('读取页面失败，跳过: {} | 条目: {}', file_path, entry.name)
            continue
        try:
            with Image.open(stream) as img:
                if img.width > img.height * scan_settings.spread_ratio:
                    spread_pages.append(index)
                cover_candidates.append({'entry': entry, 'index': index, 'size': img.size})
        except Exception as exc:
            logger.warning('解析页面尺寸失败，跳过: {} | 条目: {} | 错误: {}', file_path, entry.name, exc)

    cover_saved = save_cover_from_candidates(file_path, cover_candidates, cover_cache_path, scan_settings)
    return len(entries), json.dumps(spread_pages, ensure_ascii=False), cover_saved


def save_cover_from_candidates(file_path, candidates, cover_cache_path, scan_settings: ScanSettings):
    """从候选列表中选择封面并落盘缓存。"""
    if not candidates:
        return False

    best_candidate = None
    for cand in candidates:
        name_no_ext = os.path.splitext(os.path.basename(cand['entry'].name))[0].lower()
        if name_no_ext in COVER_FILENAMES:
            best_candidate = cand
            break

    if not best_candidate:
        candidates.sort(key=lambda x: x['index'])
        best_candidate = candidates[0]

    file_hash_for_cover = get_sha256_hash(file_path)
    if not file_hash_for_cover:
        return False

    cover_filename = f"{file_hash_for_cover}.webp"
    cover_path = os.path.join(cover_cache_path, cover_filename)

    if os.path.exists(cover_path):
        return True

    try:
        stream = read_entry_stream(file_path, best_candidate['entry'])
        if stream is None:
            logger.warning('封面提取失败: {} | 条目: {}', file_path, best_candidate['entry'].name)
            return False

        with Image.open(stream) as img:
            max_width = scan_settings.cover.max_width
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            img.save(
                cover_path,
                'webp',
                quality=scan_settings.cover.quality_start,
                optimize=True,
            )

        file_size_kb = os.path.getsize(cover_path) / 1024
        quality = scan_settings.cover.quality_start
        while file_size_kb > scan_settings.cover.target_kb and quality > scan_settings.cover.quality_min:
            quality -= scan_settings.cover.quality_step
            with Image.open(cover_path) as img:
                img.save(cover_path, 'webp', quality=quality, optimize=True)
            file_size_kb = os.path.getsize(cover_path) / 1024

        return True

    except Exception as e:
        socketio.emit('scan_error', {'error': f'生成封面失败: {os.path.basename(file_path)}: {e}'})
        logger.error('生成封面失败: {} | 错误: {}', file_path, e)
        return False


def process_file_task(args):
    """多进程 worker：处理单个文件，返回解析结果。"""
    file_path, cover_cache_path, scan_settings = args
    file_hash = get_sha256_hash(file_path)
    if not file_hash:
        return {'status': 'error', 'file_path': file_path, 'reason': 'hash_failed'}

    analysis_result = analyze_archive(file_path, cover_cache_path, scan_settings)
    if analysis_result is None:
        return {'status': 'error', 'file_path': file_path, 'reason': 'analysis_failed'}

    total_pages, spread_pages_json, _ = analysis_result
    file_size = os.path.getsize(file_path)

    filename = os.path.basename(file_path)
    tag_names = re.findall(r'\[(.*?)\]', filename)

    return {
        'status': 'ok',
        'file_path': file_path,
        'file_hash': file_hash,
        'file_size': file_size,
        'total_pages': total_pages,
        'spread_pages': spread_pages_json,
        'tag_names': tag_names,
    }


@huey.task()
def start_scan_task(directory_path, task_db_id=None):
    """
    扫描目录、哈希文件并写入数据库，支持多进程。
    """
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        from ..models.manga import Task

        task_record = None
        if task_db_id:
            task_record = Task.query.get(task_db_id)
            if task_record:
                task_record.status = 'running'
                task_record.started_at = datetime.datetime.utcnow()
                db.session.commit()

        cover_cache_path = current_app.config['COVER_CACHE_PATH']
        scan_settings = get_scan_settings()

        socketio.emit('scan_progress', {
            'progress': 0,
            'current_file': '开始扫描...',
            'task_id': task_db_id
        })

        try:
            File.query.filter(File.file_path.startswith(directory_path)).update({'is_missing': True})
            db.session.commit()

            all_files_to_scan = []
            for root, _, files in os.walk(directory_path):
                for file in files:
                    if os.path.splitext(file)[1].lower() in SUPPORTED_ARCHIVE_EXTENSIONS:
                        all_files_to_scan.append(os.path.join(root, file))

            total_files = len(all_files_to_scan)

            if task_record:
                task_record.total_files = total_files
                db.session.commit()

            if total_files == 0:
                socketio.emit('scan_complete', {
                    'message': '扫描完成，未找到支持的文件。',
                    'task_id': task_db_id
                })
                if task_record:
                    task_record.status = 'completed'
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()
                return "扫描完成，未找到文件。"

            processed_files = 0

            with multiprocessing.Pool(processes=scan_settings.max_workers) as pool:
                tasks = [(file_path, cover_cache_path, scan_settings) for file_path in all_files_to_scan]

                for i, result in enumerate(pool.imap_unordered(process_file_task, tasks), 1):
                    if result['status'] == 'ok':
                        try:
                            file_record = File.query.filter_by(file_hash=result['file_hash']).first()

                            if file_record:
                                file_record.file_path = result['file_path']
                                file_record.is_missing = False
                            else:
                                file_record = File(
                                    file_path=result['file_path'],
                                    file_hash=result['file_hash'],
                                    file_size=result['file_size'],
                                    total_pages=result['total_pages'],
                                    spread_pages=result['spread_pages']
                                )
                                db.session.add(file_record)

                            db.session.flush()

                            if result.get('tag_names'):
                                for tag_name in result['tag_names']:
                                    tag = Tag.query.filter(Tag.name.ilike(tag_name)).first()
                                    if tag and tag not in file_record.tags:
                                        file_record.tags.append(tag)

                            db.session.commit()

                            processed_files += 1

                            if task_record:
                                task_record.progress = (i / total_files) * 100
                                task_record.processed_files = processed_files
                                task_record.current_file = f"已处理: {os.path.basename(result['file_path'])}"
                                db.session.commit()

                            socketio.emit('scan_progress', {
                                'progress': (i / total_files) * 100,
                                'current_file': f"已处理: {os.path.basename(result['file_path'])}",
                                'task_id': task_db_id
                            })
                        except Exception as e:
                            db.session.rollback()
                            error_msg = f'写入数据库失败: {os.path.basename(result["file_path"])}: {e}'
                            socketio.emit('scan_error', {'error': error_msg, 'task_id': task_db_id})

                            if task_record:
                                task_record.error_message = error_msg
                                db.session.commit()
                    else:
                        error_msg = f'处理失败: {os.path.basename(result.get("file_path", "Unknown"))}: {result.get("reason", "Unknown")}'
                        socketio.emit('scan_error', {'error': error_msg, 'task_id': task_db_id})

                        if task_record:
                            task_record.error_message = error_msg
                            db.session.commit()

                missing_files_count = File.query.filter_by(is_missing=True).count()
                logger.info('扫描完成，标记缺失文件数量: {}', missing_files_count)

                if task_record:
                    task_record.status = 'completed'
                    task_record.progress = 100.0
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()

                socketio.emit('scan_complete', {
                    'message': f'扫描完成，已处理 {total_files} 个文件。',
                    'task_id': task_db_id
                })

        except Exception as e:
            error_msg = f'扫描失败: {str(e)}'
            socketio.emit('scan_error', {'error': error_msg, 'task_id': task_db_id})

            if task_record:
                task_record.status = 'failed'
                task_record.error_message = error_msg
                task_record.finished_at = datetime.datetime.utcnow()
                db.session.commit()

            raise

    return f"扫描完成: {directory_path}"
