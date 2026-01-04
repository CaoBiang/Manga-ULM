import datetime
import hashlib
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple

from flask import current_app
from loguru import logger

from .. import db, huey
from .. import create_app
from ..infrastructure.archive_reader import SUPPORTED_ARCHIVE_EXTENSIONS, get_archive_entries
from ..models.manga import File, LibraryPath, Tag, TagAlias, Task
from ..services.cover_service import CoverPathConfig, generate_cover, get_cover_path
from ..services.path_service import normalize_file_path
from ..services.settings_service import get_cover_cache_shard_count, get_scan_settings, ScanSettings


@dataclass(frozen=True)
class DiscoveredArchive:
    """扫描阶段发现的单个压缩文件（只包含轻量元数据）。"""

    file_path: str
    file_size: int
    file_mtime: int


@dataclass(frozen=True)
class CoverJob:
    """封面生成任务（不触碰数据库）。"""

    file_id: int
    file_path: str
    force: bool


def _normalize_path(path: str) -> str:
    """归一化路径，避免同一文件出现多种写法。"""
    return normalize_file_path(path)


def _iter_archives(root_dir: str) -> Iterable[DiscoveredArchive]:
    """遍历目录，产出所有支持的压缩文件（含 size/mtime）。"""
    root_dir = _normalize_path(root_dir)
    for current_root, _, files in os.walk(root_dir):
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in SUPPORTED_ARCHIVE_EXTENSIONS:
                continue
            file_path = _normalize_path(os.path.join(current_root, filename))
            try:
                stat = os.stat(file_path)
                yield DiscoveredArchive(
                    file_path=file_path,
                    file_size=int(stat.st_size),
                    file_mtime=int(stat.st_mtime),
                )
            except OSError as exc:
                logger.warning('无法读取文件信息，跳过: {} | 错误: {}', file_path, exc)


def _chunked(items: List[str], chunk_size: int) -> Iterable[List[str]]:
    for i in range(0, len(items), chunk_size):
        yield items[i : i + chunk_size]


def _extract_tags_from_filename(file_path: str) -> List[str]:
    """从文件名中提取形如 [tag] 的标签。"""
    filename = os.path.basename(file_path)
    return re.findall(r'\[(.*?)\]', filename)


def _calculate_sha256(file_path: str, *, chunk_size: int = 1024 * 1024) -> Optional[str]:
    """计算文件 SHA-256（用于内容识别，较耗时）。"""
    sha256 = hashlib.sha256()
    try:
        with open(file_path, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                sha256.update(chunk)
        return sha256.hexdigest()
    except OSError as exc:
        logger.warning('计算 SHA-256 失败: {} | 错误: {}', file_path, exc)
        return None


def _analyze_archive(file_path: str, scan_settings: ScanSettings) -> Tuple[int, Optional[str], List[str]]:
    """
    轻量分析：
    - 页数：仅读取压缩包目录索引（不解压整本）。
    - 内容哈希：按配置可选（需要读完整文件）。
    - 标签：从文件名提取。
    """
    entries = get_archive_entries(file_path)
    total_pages = len(entries)

    content_sha256: Optional[str] = None
    if scan_settings.hash_mode == 'full':
        content_sha256 = _calculate_sha256(file_path)

    tags = _extract_tags_from_filename(file_path)
    return total_pages, content_sha256, tags


def _is_cancelled(task_db_id: Optional[int]) -> bool:
    """检查任务是否被标记为取消。"""
    if not task_db_id:
        return False
    status = db.session.query(Task.status).filter(Task.id == int(task_db_id)).scalar()
    return status == 'cancelled'


@huey.task()
def start_scan_task(library_path_id: int, task_db_id: Optional[int] = None) -> str:
    """
    扫描指定图书馆路径：
    - 发现压缩包文件
    - 对比 size/mtime 实现增量扫描
    - 可选计算内容 SHA-256（用于移动/重复识别）
    """
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        task_record = db.session.get(Task, task_db_id) if task_db_id else None
        if task_record:
            task_record.status = 'running'
            task_record.started_at = datetime.datetime.utcnow()
            task_record.current_file = '开始扫描...'
            db.session.commit()

        library_path = db.session.get(LibraryPath, int(library_path_id))
        if not library_path:
            error_msg = f'扫描失败：不存在的图书馆路径 ID: {library_path_id}'
            if task_record:
                task_record.status = 'failed'
                task_record.error_message = error_msg
                task_record.finished_at = datetime.datetime.utcnow()
                db.session.commit()
            return error_msg

        # 路径不可用时直接失败，避免“扫描完成但为 0”误导用户。
        if not os.path.isdir(library_path.path):
            error_msg = f'扫描失败：图书馆路径不可访问或不是目录: {library_path.path}'
            if task_record:
                task_record.status = 'failed'
                task_record.error_message = error_msg
                task_record.finished_at = datetime.datetime.utcnow()
                db.session.commit()
            return error_msg

        scan_settings = get_scan_settings()
        cover_enabled = scan_settings.cover_mode == 'scan'
        cancel_check_interval_s = max(0.05, float(scan_settings.cancel_check_interval_ms) / 1000.0)
        cancelled_cache = False
        last_cancel_check_at = 0.0

        def is_cancelled() -> bool:
            """带节流的取消检测，避免高频读数据库。"""
            nonlocal cancelled_cache, last_cancel_check_at
            if cancelled_cache:
                return True
            if not task_db_id:
                return False
            now = time.monotonic()
            if now - last_cancel_check_at < cancel_check_interval_s:
                return False
            last_cancel_check_at = now
            cancelled_cache = _is_cancelled(task_db_id)
            return cancelled_cache

        # 预加载标签与别名映射，避免在扫描写入阶段触发 N+1 查询。
        tags_by_lower_name = {}
        tags_by_id = {}
        alias_to_tag_id = {}
        try:
            for tag in Tag.query.all():
                if tag.name:
                    tags_by_lower_name[str(tag.name).strip().lower()] = tag
                tags_by_id[int(tag.id)] = tag
            for alias in TagAlias.query.all():
                if alias.alias_name:
                    alias_to_tag_id[str(alias.alias_name).strip().lower()] = int(alias.tag_id)
        except Exception as exc:
            logger.warning('预加载标签映射失败，将只匹配已加载标签: {}', exc)

        def resolve_tag(tag_name: str) -> Optional[Tag]:
            if not tag_name:
                return None
            key = str(tag_name).strip().lower()
            if not key:
                return None
            tag = tags_by_lower_name.get(key)
            if tag:
                return tag
            tag_id = alias_to_tag_id.get(key)
            if tag_id is not None:
                return tags_by_id.get(int(tag_id))
            return None

        cover_config = None
        if cover_enabled:
            cover_config = CoverPathConfig(
                base_dir=current_app.config['COVER_CACHE_PATH'],
                shard_count=get_cover_cache_shard_count(),
            )

        try:
            discovered = list(_iter_archives(library_path.path))
            total_files = len(discovered)
            discovered_paths = [item.file_path for item in discovered]
            discovered_set = set(discovered_paths)

            if task_record:
                task_record.total_files = total_files
                task_record.processed_files = 0
                task_record.progress = 0.0
                task_record.current_file = ''
                task_record.target_path = library_path.path
                task_record.target_library_path_id = library_path.id
                db.session.commit()

            # 根据“本次发现的路径集合”增量同步缺失标记，避免全表写入与失败误标。
            missing_paths: List[str] = []
            for (existing_path,) in db.session.query(File.file_path).filter(
                File.library_path_id == library_path.id,
                File.is_missing.is_(False),
            ):
                if existing_path not in discovered_set:
                    missing_paths.append(existing_path)

            present_missing_paths: List[str] = []
            for (missing_path,) in db.session.query(File.file_path).filter(
                File.library_path_id == library_path.id,
                File.is_missing.is_(True),
            ):
                if missing_path in discovered_set:
                    present_missing_paths.append(missing_path)

            for chunk in _chunked(missing_paths, 500):
                (
                    File.query.filter(
                        File.library_path_id == library_path.id,
                        File.is_missing.is_(False),
                        File.file_path.in_(chunk),
                    ).update({'is_missing': True}, synchronize_session=False)
                )

            for chunk in _chunked(present_missing_paths, 500):
                (
                    File.query.filter(
                        File.library_path_id == library_path.id,
                        File.is_missing.is_(True),
                        File.file_path.in_(chunk),
                    ).update({'is_missing': False}, synchronize_session=False)
                )

            if missing_paths or present_missing_paths:
                db.session.commit()

            if total_files == 0:
                msg = '扫描完成，未找到支持的文件。'
                if task_record:
                    task_record.status = 'completed'
                    task_record.progress = 100.0
                    task_record.current_file = ''
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()
                return msg

            # 预加载已存在记录，避免逐个查询。
            existing_by_path = {}
            for chunk in _chunked(discovered_paths, 500):
                for row in File.query.filter(File.file_path.in_(chunk)).all():
                    existing_by_path[row.file_path] = row

            to_analyze: List[DiscoveredArchive] = []
            unchanged_count = 0
            unchanged_records: List[File] = []
            for item in discovered:
                existing = existing_by_path.get(item.file_path)
                if (
                    existing
                    and existing.file_size == item.file_size
                    and existing.file_mtime == item.file_mtime
                ):
                    unchanged_count += 1
                    unchanged_records.append(existing)
                    continue
                to_analyze.append(item)

            cover_jobs: List[CoverJob] = []
            expected_cover_units = 0
            if cover_enabled and cover_config and scan_settings.cover_regenerate_missing and unchanged_records:
                for record in unchanged_records:
                    cover_path = get_cover_path(cover_config, record.id)
                    if not os.path.exists(cover_path):
                        cover_jobs.append(CoverJob(file_id=record.id, file_path=record.file_path, force=True))
                expected_cover_units += len(cover_jobs)

            if cover_enabled:
                # 对于需要重分析的文件，默认认为都需要生成/刷新封面（失败则记为“封面步骤完成但失败”）
                expected_cover_units += len(to_analyze)

            processed = 0  # 文件处理进度（用于 Task.processed_files）
            done_units = 0  # 总进度（包含“文件”与“封面”两类工作单元）
            analysis_errors = 0
            cover_errors = 0
            work_total_units = total_files + expected_cover_units

            def update_progress(current_file: str) -> None:
                progress = (done_units / work_total_units) * 100 if work_total_units else 100
                if task_record:
                    task_record.progress = progress
                    task_record.processed_files = processed
                    task_record.current_file = current_file

            # 未变更文件直接计入进度（不做重分析）
            if unchanged_count:
                processed += unchanged_count
                done_units += unchanged_count
                update_progress(f'已跳过未变更文件: {unchanged_count} 个')
                db.session.commit()

            if is_cancelled():
                msg = '扫描已取消。'
                if task_record:
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()
                return msg

            max_workers = max(1, int(scan_settings.max_workers))
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_map = {
                    executor.submit(_analyze_archive, item.file_path, scan_settings): item
                    for item in to_analyze
                }

                for future in as_completed(future_map):
                    item = future_map[future]

                    if is_cancelled():
                        msg = '扫描已取消。'
                        if task_record:
                            task_record.finished_at = datetime.datetime.utcnow()
                            db.session.commit()
                        return msg

                    try:
                        total_pages, content_sha256, tag_names = future.result()
                    except Exception as exc:
                        analysis_errors += 1
                        processed += 1
                        done_units += 1
                        if cover_enabled:
                            # 该文件的封面步骤无法执行，按失败计入总进度
                            done_units += 1
                            cover_errors += 1
                        error_msg = f'解析失败: {os.path.basename(item.file_path)} | 错误: {exc}'
                        logger.warning(error_msg)
                        update_progress(error_msg)
                        if task_record:
                            task_record.error_message = error_msg
                        if processed % 10 == 0 or processed == total_files:
                            db.session.commit()
                        continue

                    # 写入数据库（仅在主线程中操作 DB Session）
                    try:
                        existing = existing_by_path.get(item.file_path)
                        file_record = None

                        if existing:
                            file_record = existing
                        else:
                            # 新路径：尝试用内容哈希匹配“被标记缺失的旧记录”，用于移动/重命名识别。
                            if content_sha256:
                                candidates = (
                                    File.query.filter_by(
                                        library_path_id=library_path.id,
                                        is_missing=True,
                                        content_sha256=content_sha256,
                                    )
                                    .order_by(File.add_date.desc())
                                    .limit(2)
                                    .all()
                                )
                                if len(candidates) == 1:
                                    file_record = candidates[0]

                        if file_record:
                            file_record.library_path_id = library_path.id
                            file_record.file_path = item.file_path
                            file_record.file_size = item.file_size
                            file_record.file_mtime = item.file_mtime
                            file_record.total_pages = total_pages
                            file_record.content_sha256 = content_sha256
                            file_record.is_missing = False
                        else:
                            file_record = File(
                                library_path_id=library_path.id,
                                file_path=item.file_path,
                                file_size=item.file_size,
                                file_mtime=item.file_mtime,
                                total_pages=total_pages,
                                content_sha256=content_sha256,
                                is_missing=False,
                            )
                            db.session.add(file_record)

                        db.session.flush()

                        if tag_names:
                            for tag_name in tag_names:
                                tag = resolve_tag(tag_name)
                                if tag and tag not in file_record.tags:
                                    file_record.tags.append(tag)

                        processed += 1
                        done_units += 1
                        update_progress(f'已处理: {os.path.basename(item.file_path)}')

                        if cover_enabled and cover_config:
                            cover_jobs.append(CoverJob(file_id=file_record.id, file_path=file_record.file_path, force=True))

                        if processed % 10 == 0 or processed == total_files:
                            db.session.commit()
                    except Exception as exc:
                        db.session.rollback()
                        analysis_errors += 1
                        processed += 1
                        done_units += 1
                        if cover_enabled:
                            done_units += 1
                            cover_errors += 1
                        error_msg = f'写入失败: {os.path.basename(item.file_path)} | 错误: {exc}'
                        logger.warning(error_msg)
                        update_progress(error_msg)
                        if task_record:
                            task_record.error_message = error_msg
                        if processed % 10 == 0 or processed == total_files:
                            db.session.commit()

            # 统一生成封面（避免在分析阶段反复打开压缩包）
            if cover_enabled and cover_config and cover_jobs:
                update_progress('开始生成封面...')
                cover_success_ids: List[int] = []
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    future_map = {
                        executor.submit(
                            generate_cover,
                            file_id=job.file_id,
                            file_path=job.file_path,
                            config=cover_config,
                            max_width=scan_settings.cover.max_width,
                            target_kb=scan_settings.cover.target_kb,
                            quality_start=scan_settings.cover.quality_start,
                            quality_min=scan_settings.cover.quality_min,
                            quality_step=scan_settings.cover.quality_step,
                            force=job.force,
                        ): job
                        for job in cover_jobs
                    }

                    for future in as_completed(future_map):
                        job = future_map[future]

                        if is_cancelled():
                            msg = '扫描已取消。'
                            if task_record:
                                task_record.finished_at = datetime.datetime.utcnow()
                                db.session.commit()
                            return msg

                        ok = False
                        try:
                            ok = bool(future.result())
                        except Exception as exc:
                            logger.warning('封面生成异常: {} | 错误: {}', os.path.basename(job.file_path), exc)
                            ok = False

                        done_units += 1
                        if not ok:
                            cover_errors += 1
                            error_msg = f'封面生成失败: {os.path.basename(job.file_path)}'
                            update_progress(error_msg)
                        else:
                            cover_success_ids.append(int(job.file_id))
                            update_progress(f'封面已生成: {os.path.basename(job.file_path)}')

                        if cover_success_ids and (len(cover_success_ids) >= 50 or done_units == work_total_units):
                            now_ts = int(time.time())
                            for chunk in _chunked(cover_success_ids, 500):
                                (
                                    File.query.filter(File.id.in_(chunk)).update(
                                        {'cover_updated_at': now_ts},
                                        synchronize_session=False,
                                    )
                                )
                            cover_success_ids.clear()

                        if task_record and (done_units % 20 == 0 or done_units == work_total_units):
                            db.session.commit()

            missing_files_count = File.query.filter_by(library_path_id=library_path.id, is_missing=True).count()
            logger.info(
                '扫描完成：总计 {} 个文件，未变更跳过 {} 个，分析/写入失败 {} 个，封面失败 {} 个，缺失标记 {} 个',
                total_files,
                unchanged_count,
                analysis_errors,
                cover_errors,
                missing_files_count,
            )

            # 提交尾部不足批次的变更
            db.session.commit()

            if task_record:
                task_record.status = 'completed'
                task_record.progress = 100.0
                task_record.finished_at = datetime.datetime.utcnow()
                db.session.commit()

            return f'扫描完成: {library_path.path}'

        except Exception as exc:
            error_msg = f'扫描失败: {exc}'
            if task_record:
                task_record.status = 'failed'
                task_record.error_message = error_msg
                task_record.finished_at = datetime.datetime.utcnow()
                db.session.commit()
            raise
