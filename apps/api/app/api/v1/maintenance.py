from flask import jsonify, request
from . import api
from sqlalchemy import func
from ...models import File
from ... import db
from .files import file_to_dict
from ...services.task_service import (
    create_task_record,
    fail_task,
    finish_task,
    mark_task_running,
    update_task_progress,
)
from ...tasks.maintenance import check_integrity_task

@api.route('/integrity-checks', methods=['POST'])
def check_integrity():
    """
    启动完整性检查任务：
    - 检查文件是否缺失
    - 尝试读取压缩包目录，标记可能的损坏文件
    """
    task_record = create_task_record(
        name='完整性检查',
        task_type='integrity',
        status='pending',
        total_files=0,
        processed_files=0,
        progress=0.0,
        current_file='准备中...',
    )

    try:
        task = check_integrity_task(task_db_id=task_record.id)
        task_record.task_id = task.id
        db.session.commit()
        return jsonify({
            'message': '已提交完整性检查任务，请在任务管理器中查看进度',
            'task_id': task.id,
            'db_task_id': task_record.id
        }), 202
    except Exception as exc:
        db.session.rollback()
        fail_task(task_record, error_message=f'提交完整性检查任务失败: {str(exc)}')
        return jsonify({'error': f'提交完整性检查任务失败: {str(exc)}'}), 500

@api.route('/reports/duplicate-files', methods=['GET'])
def get_duplicate_files_report():
    """
    查找并返回内容重复的文件分组（基于 content_sha256）。
    """
    duplicate_hashes = (
        db.session.query(File.content_sha256, func.count(File.id).label('count'))
        .filter(File.content_sha256.isnot(None), File.content_sha256 != '')
        .group_by(File.content_sha256)
        .having(func.count(File.id) > 1)
        .all()
    )

    if not duplicate_hashes:
        return jsonify([])

    results = []
    try:
        for hash_val, _count in duplicate_hashes:
            files = File.query.filter_by(content_sha256=hash_val).all()
            results.append([file_to_dict(f) for f in files])
    except Exception as exc:
        return jsonify({'error': f'查找重复文件失败: {str(exc)}'}), 500

    return jsonify(results)

@api.route('/missing-file-cleanups', methods=['POST'])
def cleanup_missing():
    """
    删除缺失文件记录（同步执行，但会记录到任务管理器）。
    """
    data = request.get_json(silent=True) or {}
    ids_to_delete = data.get('file_ids')
    if ids_to_delete is None:
        ids_to_delete = data.get('ids')
    if not isinstance(ids_to_delete, list):
        return jsonify({'error': '必须提供 file_ids（文件 ID 列表）'}), 400

    if not ids_to_delete:
        return jsonify({'message': '未提供需要删除的记录', 'deleted_count': 0})

    task_record = create_task_record(
        name=f'清理缺失文件记录（{len(ids_to_delete)} 条）',
        task_type='missing_cleanup',
        status='pending',
        total_files=len(ids_to_delete),
        processed_files=0,
        progress=0.0,
        current_file='准备中...',
    )
    mark_task_running(task_record, current_file='删除中...', total_files=len(ids_to_delete), processed_files=0)

    try:
        # Ensure we only try to delete files that are actually marked as missing
        query = File.query.filter(File.id.in_(ids_to_delete), File.is_missing == True)

        deleted_count = query.delete(synchronize_session=False)
        db.session.commit()

        update_task_progress(
            task_record,
            processed_files=int(deleted_count or 0),
            total_files=len(ids_to_delete),
            current_file='',
        )
        finish_task(task_record, status='completed')

        return jsonify({
            'message': f'已删除 {deleted_count} 条缺失文件记录',
            'deleted_count': deleted_count,
            'db_task_id': task_record.id
        })
    except Exception as exc:
        db.session.rollback()
        fail_task(task_record, error_message=f'清理缺失文件记录失败: {str(exc)}')
        return jsonify({'error': f'清理缺失文件记录失败: {str(exc)}'}), 500
