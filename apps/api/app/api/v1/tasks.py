from flask import jsonify, request
from . import api
from ... import db
from ...models.manga import Task

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

@api.route('/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    """
    获取单个任务的详细信息
    """
    task = Task.query.get_or_404(task_id)
    return jsonify(task.to_dict())

@api.route('/tasks/active', methods=['GET'])
def get_active_tasks():
    """
    获取所有活跃任务 (pending 和 running 状态)
    """
    active_tasks = Task.query.filter(Task.status.in_(['pending', 'running'])).all()
    
    return jsonify({
        'tasks': [task.to_dict() for task in active_tasks],
        'count': len(active_tasks)
    })

@api.route('/tasks/scan/active', methods=['GET'])
def get_active_scan_tasks():
    """
    获取活跃的扫描任务
    """
    active_scan_tasks = Task.query.filter(
        Task.task_type == 'scan',
        Task.status.in_(['pending', 'running'])
    ).all()
    
    return jsonify({
        'tasks': [task.to_dict() for task in active_scan_tasks],
        'count': len(active_scan_tasks)
    })

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

@api.route('/tasks/<int:task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """
    取消任务（标记为取消状态）
    注意：这只会在数据库中标记任务为取消状态，不会真正停止Huey任务
    """
    task = Task.query.get_or_404(task_id)
    
    if task.status in ['pending', 'running']:
        task.status = 'cancelled'
        task.finished_at = db.func.now()
        db.session.commit()
        
        return jsonify({
            'message': '任务已取消',
            'task': task.to_dict()
        })
    else:
        return jsonify({
            'error': '任务当前状态不支持取消',
            'current_status': task.status
        }), 400

@api.route('/tasks/cleanup', methods=['POST'])
def cleanup_completed_tasks():
    """
    清理已完成的任务记录
    """
    # 删除30天前的已完成任务
    from datetime import datetime, timedelta
    
    cutoff_date = datetime.utcnow() - timedelta(days=30)
    
    deleted_count = Task.query.filter(
        Task.status.in_(['completed', 'failed', 'cancelled']),
        Task.finished_at < cutoff_date
    ).delete()
    
    db.session.commit()
    
    return jsonify({
        'message': f'已清理 {deleted_count} 条过期任务记录',
        'deleted_count': deleted_count
    }) 
