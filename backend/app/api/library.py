from flask import request, jsonify
from . import api
from .. import huey, socketio, db
from ..models.manga import Config, LibraryPath, Task
from ..tasks.scanner import start_scan_task

@api.route('/library/scan', methods=['POST'])
def scan_library():
    """
    Starts a library scan task.
    Expects a JSON payload with a 'path' key.
    e.g., {"path": "/path/to/manga/library"}
    """
    path = request.json.get('path')
    if not path:
        return jsonify({'error': 'Path is required'}), 400
    
    # Check if there's already an active scan task for this path
    existing_task = Task.query.filter_by(
        task_type='scan',
        target_path=path,
        status='running'
    ).first()
    
    if existing_task:
        return jsonify({
            'error': 'A scan task is already running for this path',
            'task_id': existing_task.task_id
        }), 409
    
    # Get max workers from config, with a default value
    max_workers_setting = Config.query.get('scan.max_workers')
    if max_workers_setting and max_workers_setting.value.isdigit():
        max_workers = int(max_workers_setting.value)
    else:
        max_workers = 12 # Default value
    
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
    task = start_scan_task(path, max_workers=max_workers, task_db_id=task_record.id)
    
    # Update task record with Huey task ID
    task_record.task_id = task.id
    db.session.commit()
    
    return jsonify({
        'message': 'Scan started', 
        'task_id': task.id,
        'db_task_id': task_record.id
    }), 202

@api.route('/library/scan_all', methods=['POST'])
def scan_all_libraries():
    """
    Starts scan tasks for all registered library paths.
    """
    paths = LibraryPath.query.all()
    if not paths:
        return jsonify({'error': 'No library paths have been configured.'}), 400
    
    # Check if there are any active scan tasks
    active_tasks = Task.query.filter_by(
        task_type='scan',
        status='running'
    ).all()
    
    if active_tasks:
        return jsonify({
            'error': 'There are already running scan tasks. Please wait for them to complete.',
            'active_tasks': [task.to_dict() for task in active_tasks]
        }), 409
    
    # Get max workers from config, with a default value
    max_workers_setting = Config.query.get('scan.max_workers')
    if max_workers_setting and max_workers_setting.value.isdigit():
        max_workers = int(max_workers_setting.value)
    else:
        max_workers = 12 # Default value

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
        task = start_scan_task(p.path, max_workers=max_workers, task_db_id=task_record.id)
        
        # Update task record with Huey task ID
        task_record.task_id = task.id
        db.session.commit()
        
        tasks.append({
            'path': p.path, 
            'task_id': task.id,
            'db_task_id': task_record.id
        })
        
    return jsonify({'message': 'Scan started for all libraries', 'tasks': tasks}), 202

# Placeholder for other library-related endpoints from the design doc
@api.route('/library/sync-report', methods=['GET'])
def get_sync_report():
    # TODO: Implement sync report logic
    return jsonify({'message': 'Sync report placeholder'}) 