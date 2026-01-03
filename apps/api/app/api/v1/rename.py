from flask import request, jsonify
from . import api
from ... import db
from ...models import File
from ...tasks.rename import batch_rename_task, rename_single_file_inplace
from .files import file_to_dict

@api.route('/rename/batch', methods=['POST'])
def batch_rename():
    """
    启动“批量重命名”后台任务（基于模板 + 文件ID列表）。
    """
    data = request.get_json()
    if not data or not data.get('template') or not data.get('file_ids') or not data.get('root_path'):
        return jsonify({'error': 'template、file_ids、root_path 为必填项'}), 400

    template = data['template']
    file_ids = data['file_ids']
    root_path = data['root_path']

    if not isinstance(file_ids, list):
        return jsonify({'error': 'file_ids 必须是数组'}), 400

    # Start the background task
    task = batch_rename_task(file_ids, template, root_path)
    
    return jsonify({'task_id': task.id}), 202

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
