from flask import request, jsonify
from . import api
from .. import huey, socketio, db
from ...models.manga import LibraryPath, Task
from ...tasks.scanner import start_scan_task

@api.route('/library/scan', methods=['POST'])
def scan_library():
    """
    启动单个路径的图书馆扫描任务。

    请求体示例：{"path": "D:/漫画库"}
    """
    path = request.json.get('path')
    if not path:
        return jsonify({'error': '必须提供扫描路径'}), 400
    
    # Check if there's already an active scan task for this path
    existing_task = Task.query.filter_by(
        task_type='scan',
        target_path=path,
        status='running'
    ).first()
    
    if existing_task:
        return jsonify({
            'error': '该路径已存在运行中的扫描任务',
            'task_id': existing_task.task_id
        }), 409

    # Create task record in database
    task_record = Task(
        name=f'扫描路径: {path}',
        task_type='scan',
        target_path=path,
        status='pending'
    )
    db.session.add(task_record)
    db.session.commit()
    
    # Dispatch the background task
    task = start_scan_task(path, task_db_id=task_record.id)
    
    # Update task record with Huey task ID
    task_record.task_id = task.id
    db.session.commit()
    
    return jsonify({
        'message': '已开始扫描', 
        'task_id': task.id,
        'db_task_id': task_record.id
    }), 202

@api.route('/library/scan_all', methods=['POST'])
def scan_all_libraries():
    """
    启动所有已配置图书馆路径的扫描任务。
    """
    paths = LibraryPath.query.all()
    if not paths:
        return jsonify({'error': '尚未配置图书馆路径'}), 400
    
    # Check if there are any active scan tasks
    active_tasks = Task.query.filter_by(
        task_type='scan',
        status='running'
    ).all()
    
    if active_tasks:
        return jsonify({
            'error': '当前存在运行中的扫描任务，请等待完成后再试',
            'active_tasks': [task.to_dict() for task in active_tasks]
        }), 409

    tasks = []
    for p in paths:
        # Create task record in database
        task_record = Task(
            name=f'扫描路径: {p.path}',
            task_type='scan',
            target_path=p.path,
            status='pending'
        )
        db.session.add(task_record)
        db.session.commit()
        
        # Dispatch the background task
        task = start_scan_task(p.path, task_db_id=task_record.id)
        
        # Update task record with Huey task ID
        task_record.task_id = task.id
        db.session.commit()
        
        tasks.append({
            'path': p.path, 
            'task_id': task.id,
            'db_task_id': task_record.id
        })
        
    return jsonify({'message': '已开始扫描全部图书馆路径', 'tasks': tasks}), 202

# Placeholder for other library-related endpoints from the design doc
@api.route('/library/sync-report', methods=['GET'])
def get_sync_report():
    # TODO: Implement sync report logic
    return jsonify({'message': '同步报告功能尚未实现'}) 
