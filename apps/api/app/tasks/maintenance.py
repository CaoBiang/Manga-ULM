# -*- coding: utf-8 -*-
from __future__ import annotations

import datetime
import os
from typing import Optional

from loguru import logger

from .. import db, huey, create_app
from ..infrastructure.archive_reader import get_archive_entries
from ..models.manga import File, Task
from ..services.task_service import fail_task, finish_task, is_task_cancelled, mark_task_running, update_task_progress


@huey.task()
def check_integrity_task(task_db_id: Optional[int] = None) -> str:
    """
    完整性检查任务：
    - 检查文件是否缺失（File.is_missing）
    - 尝试读取压缩包目录，标记损坏文件（File.integrity_status: ok/corrupted/unknown）
    """
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')

    with app.app_context():
        task_record = db.session.get(Task, int(task_db_id)) if task_db_id else None
        try:
            total = int(db.session.query(File.id).count())
            mark_task_running(task_record, current_file='开始完整性检查...', total_files=total, processed_files=0)

            processed = 0
            batch_size = 50

            for file_obj in File.query.order_by(File.id.asc()).yield_per(200):
                if is_task_cancelled(task_db_id):
                    finish_task(task_record, status='cancelled', message='用户已取消')
                    db.session.commit()
                    return 'cancelled'

                processed += 1
                file_path = str(file_obj.file_path or '')

                # 缺失判断
                if not file_path or not os.path.exists(file_path):
                    file_obj.is_missing = True
                    file_obj.integrity_status = 'unknown'
                else:
                    file_obj.is_missing = False
                    try:
                        # 读取目录即可（不解压整本），失败则认为可能损坏
                        _entries = get_archive_entries(file_path)
                        file_obj.integrity_status = 'ok' if _entries is not None else 'unknown'
                    except Exception:
                        file_obj.integrity_status = 'corrupted'

                if processed % batch_size == 0 or processed == total:
                    db.session.commit()
                    update_task_progress(
                        task_record,
                        processed_files=processed,
                        total_files=total,
                        current_file=file_path,
                    )

            db.session.commit()
            update_task_progress(task_record, processed_files=processed, total_files=total, current_file='')
            finish_task(task_record, status='completed')
            return 'completed'
        except Exception as exc:
            db.session.rollback()
            logger.exception('完整性检查失败: {}', exc)
            fail_task(task_record, error_message=f'完整性检查失败: {str(exc)}')
            return 'failed'

