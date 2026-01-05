from __future__ import annotations

import datetime
from typing import Optional

from loguru import logger

from .. import db
from ..models.manga import Task


def create_task_record(
    *,
    name: str,
    task_type: str,
    status: str = 'pending',
    target_path: Optional[str] = None,
    target_library_path_id: Optional[int] = None,
    total_files: int = 0,
    processed_files: int = 0,
    progress: float = 0.0,
    current_file: str = '',
) -> Task:
    """创建任务记录并写入数据库。"""
    record = Task(
        name=str(name or '').strip() or task_type,
        task_type=str(task_type or '').strip() or 'unknown',
        status=status,
        target_path=target_path,
        target_library_path_id=target_library_path_id,
        total_files=int(total_files or 0),
        processed_files=int(processed_files or 0),
        progress=float(progress or 0.0),
        current_file=current_file or '',
    )
    db.session.add(record)
    db.session.commit()
    return record


def is_task_cancelled(task_db_id: Optional[int]) -> bool:
    """检查任务是否被标记为取消。"""
    if not task_db_id:
        return False
    status = db.session.query(Task.status).filter(Task.id == int(task_db_id)).scalar()
    return status == 'cancelled'


def mark_task_running(
    task_record: Optional[Task],
    *,
    current_file: str = '',
    total_files: Optional[int] = None,
    processed_files: Optional[int] = None,
    target_path: Optional[str] = None,
) -> None:
    """标记任务为运行中，并初始化统计字段。"""
    if not task_record:
        return
    task_record.status = 'running'
    task_record.started_at = datetime.datetime.utcnow()
    task_record.error_message = None
    task_record.progress = 0.0
    task_record.current_file = current_file or ''
    if total_files is not None:
        task_record.total_files = int(total_files)
    if processed_files is not None:
        task_record.processed_files = int(processed_files)
    if target_path is not None:
        task_record.target_path = target_path
    db.session.commit()


def update_task_progress(
    task_record: Optional[Task],
    *,
    processed_files: int,
    total_files: int,
    current_file: str = '',
    error_message: Optional[str] = None,
) -> None:
    """更新任务进度与当前处理对象。"""
    if not task_record:
        return
    total = max(0, int(total_files))
    processed = max(0, int(processed_files))
    progress = (processed / total) * 100 if total else 100.0

    task_record.total_files = total
    task_record.processed_files = processed
    task_record.progress = float(progress)
    task_record.current_file = current_file or ''
    if error_message:
        task_record.error_message = str(error_message)
    db.session.commit()


def finish_task(
    task_record: Optional[Task],
    *,
    status: str,
    message: Optional[str] = None,
) -> None:
    """结束任务（completed/failed/cancelled）。"""
    if not task_record:
        return
    task_record.status = status
    if status == 'completed':
        task_record.progress = 100.0
    task_record.current_file = ''
    if message:
        task_record.error_message = str(message)
    task_record.finished_at = datetime.datetime.utcnow()
    db.session.commit()


def fail_task(task_record: Optional[Task], *, error_message: str) -> None:
    """标记任务失败，并记录错误信息。"""
    try:
        finish_task(task_record, status='failed', message=error_message)
    except Exception as exc:
        logger.exception('写入任务失败状态出错: {}', exc)

