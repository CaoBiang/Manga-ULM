from flask import request, jsonify
from . import api
from ... import db
from ...models import File, Task
from ...tasks.rename import batch_rename_task, rename_single_file_inplace
from .files import file_to_dict

@api.route('/rename/batch', methods=['POST'])
def batch_rename():
    """
    启动“批量重命名”后台任务（基于模板 + 文件ID列表）。
    """
    data = request.get_json() or {}
    template = data.get('template')
    file_ids = data.get('file_ids')
    root_path = data.get('root_path')

    if not template or not isinstance(template, str):
        return jsonify({'error': 'template 为必填项'}), 400
    if not root_path or not isinstance(root_path, str):
        return jsonify({'error': 'root_path 为必填项'}), 400
    if not isinstance(file_ids, list) or len(file_ids) == 0:
        return jsonify({'error': 'file_ids 必须为非空数组'}), 400

    normalized_ids = []
    for raw_id in file_ids:
        try:
            normalized_ids.append(int(raw_id))
        except (TypeError, ValueError):
            return jsonify({'error': 'file_ids 必须为整数数组'}), 400

    task_record = Task(
        name=f'批量重命名（{len(normalized_ids)} 个文件）',
        task_type='rename',
        target_path=root_path,
        status='pending',
        total_files=len(normalized_ids),
        processed_files=0,
        progress=0.0,
    )
    db.session.add(task_record)
    db.session.commit()

    try:
        task = batch_rename_task(normalized_ids, template, root_path, task_db_id=task_record.id)
        task_record.task_id = task.id
        db.session.commit()
        return jsonify({'message': '已提交批量重命名任务', 'task_id': task.id, 'db_task_id': task_record.id}), 202
    except Exception as e:
        db.session.rollback()
        failed_record = db.session.get(Task, task_record.id)
        if failed_record:
            import datetime as _dt
            failed_record.status = 'failed'
            failed_record.error_message = f'提交任务失败: {str(e)}'
            failed_record.finished_at = _dt.datetime.utcnow()
            db.session.commit()
        return jsonify({'error': f'提交任务失败: {str(e)}'}), 500

@api.route('/rename/file/<int:file_id>', methods=['POST'])
def rename_file(file_id):
    """
    同步重命名单个文件（用于“编辑文件详情”页，立即生效）。

    说明：
    - 批量重命名走后台任务（`/rename/batch`）
    - 单文件重命名应同步执行，否则在未启动 worker 时会出现“提示成功但实际没改”的误导
    """
    data = request.get_json() or {}
    new_filename = data.get('new_filename')
    if not new_filename:
        return jsonify({'error': 'new_filename 为必填项'}), 400

    file_record = db.session.get(File, file_id)
    if not file_record:
        return jsonify({'error': '文件不存在'}), 404

    try:
        rename_single_file_inplace(file_record, new_filename)
        db.session.commit()
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'重命名失败：{e}'}), 500

    return jsonify(file_to_dict(file_record)), 200
