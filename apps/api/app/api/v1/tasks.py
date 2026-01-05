import datetime
from flask import jsonify, request
from . import api
from ... import db
from ...models.manga import Task
from ...services.settings_service import get_int_setting

@api.route('/tasks', methods=['GET'])
def get_tasks():
    """
    获取任务列表
    支持查询参数:
    - status: 按状态筛选 (pending, running, completed, failed)
    - task_type: 按类型筛选 (scan, rename, backup, etc.)
    - active_only: 只返回活跃任务 (true/false)
    - limit: 限制返回数量 (默认20)
    """
    # 获取查询参数
    status = request.args.get('status')
    task_type = request.args.get('task_type')
    active_only = request.args.get('active_only', 'false').lower() == 'true'
    limit = int(request.args.get('limit', 20))
    
    # 构建查询
    query = Task.query
    
    if status:
        query = query.filter(Task.status == status)
    
    if task_type:
        query = query.filter(Task.task_type == task_type)
    
    if active_only:
        query = query.filter(Task.status.in_(['pending', 'running']))
    
    # 按创建时间倒序排列
    query = query.order_by(Task.created_at.desc())
    
    # 限制返回数量
    if limit > 0:
        query = query.limit(limit)
    
    tasks = query.all()
    
    return jsonify({
        'tasks': [task.to_dict() for task in tasks],
        'count': len(tasks)
    })

@api.route('/tasks/<int:task_id>', methods=['GET', 'PATCH'])
def handle_task(task_id):
    """
    获取/更新单个任务。

    PATCH 目前仅用于取消任务：
    - { "status": "cancelled" }
    """
    task = Task.query.get_or_404(task_id)

    if request.method == 'GET':
        return jsonify(task.to_dict())

    payload = request.get_json(silent=True) or {}
    requested_status = payload.get('status')
    if not requested_status:
        return jsonify({'error': '必须提供 status'}), 400

    requested_status = str(requested_status).strip().lower()
    if requested_status != 'cancelled':
        return jsonify({'error': '当前仅支持将 status 更新为 cancelled'}), 400

    if task.status not in ['pending', 'running']:
        return jsonify({
            'error': '任务当前状态不支持取消',
            'current_status': task.status
        }), 400

    task.status = 'cancelled'
    task.current_file = ''
    task.finished_at = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify(task.to_dict())

@api.route('/tasks/<int:task_id>/status', methods=['GET'])
def get_task_status(task_id):
    """
    获取任务状态信息（简化版本）
    """
    task = Task.query.get_or_404(task_id)
    
    return jsonify({
        'id': task.id,
        'status': task.status,
        'progress': task.progress,
        'current_file': task.current_file,
        'error_message': task.error_message,
        'is_active': task.is_active
    })

@api.route('/task-history', methods=['DELETE'])
def cleanup_completed_tasks():
    """
    清理历史任务记录（completed/failed/cancelled）。

    参数（可选）：
    - days: 保留天数（0 表示清理全部历史任务）。优先级高于设置 `ui.tasks.history.retention_days`。
    """
    payload = request.get_json(silent=True) or {}
    raw_days = payload.get('days', None)
    if raw_days is None:
        raw_days = request.args.get('days', None)

    if raw_days is None or str(raw_days).strip() == '':
        retention_days = get_int_setting(
            'ui.tasks.history.retention_days',
            default=30,
            min_value=0,
            max_value=3650,
        )
    else:
        try:
            retention_days = int(str(raw_days).strip())
        except ValueError:
            return jsonify({'error': 'days 必须为整数'}), 400
        if retention_days < 0 or retention_days > 3650:
            return jsonify({'error': 'days 必须在 0~3650 之间'}), 400

    query = Task.query.filter(Task.status.in_(['completed', 'failed', 'cancelled']))
    if retention_days > 0:
        from datetime import datetime, timedelta

        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        query = query.filter(Task.finished_at.isnot(None), Task.finished_at < cutoff_date)

    deleted_count = query.delete(synchronize_session=False)
    db.session.commit()

    return jsonify({
        'message': f'已清理 {deleted_count} 条历史任务记录',
        'deleted_count': deleted_count,
        'retention_days': retention_days
    })
