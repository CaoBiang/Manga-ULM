from flask import jsonify, request

from . import api
from ... import db
from ...models.manga import LibraryPath, Task
from ...tasks.scanner import start_scan_task
from ...services.path_service import normalize_library_path

@api.route('/library/scan', methods=['POST'])
def scan_library():
    """
    启动单个路径的图书馆扫描任务。

    请求体示例：{"library_path_id": 1}
    """
    payload = request.get_json() or {}
    raw_library_path_id = payload.get('library_path_id')
    if raw_library_path_id is None or isinstance(raw_library_path_id, bool):
        return jsonify({'error': '必须提供 library_path_id（整数）'}), 400
    try:
        library_path_id = int(raw_library_path_id)
    except (TypeError, ValueError):
        return jsonify({'error': '必须提供 library_path_id（整数）'}), 400

    library_path = db.session.get(LibraryPath, library_path_id)
    if not library_path:
        return jsonify({'error': '图书馆路径不存在'}), 404

    normalized_path = normalize_library_path(library_path.path)
    if normalized_path != library_path.path:
        conflict = (
            LibraryPath.query.filter(LibraryPath.path == normalized_path, LibraryPath.id != library_path.id).first()
        )
        if conflict:
            return jsonify({'error': '路径归一化后与现有图书馆路径重复，请删除重复项后重试'}), 409
        library_path.path = normalized_path
        db.session.commit()

    path = library_path.path
    
    # 检查该路径是否已存在活跃扫描任务
    existing_task = Task.query.filter_by(
        task_type='scan',
        target_library_path_id=library_path_id,
    ).filter(Task.status.in_(['pending', 'running'])).first()
    
    if existing_task:
        return jsonify({
            'error': '该路径已存在运行中的扫描任务',
            'task_id': existing_task.task_id
        }), 409

    # 创建任务记录
    task_record = Task(
        name=f'扫描路径: {path}',
        task_type='scan',
        target_path=path,
        target_library_path_id=library_path_id,
        status='pending'
    )
    db.session.add(task_record)
    db.session.commit()
    
    # 投递后台任务（Huey）
    task = start_scan_task(library_path_id, task_db_id=task_record.id)
    
    # 回写 Huey 任务 ID
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

    # 扫描前先统一归一化路径，避免后台任务看不到映射盘符导致扫描为空。
    normalized_map = {}
    for p in paths:
        normalized = normalize_library_path(p.path)
        normalized_map.setdefault(normalized, []).append(p)

    duplicates = {k: v for k, v in normalized_map.items() if len(v) > 1}
    if duplicates:
        return jsonify({'error': '检测到归一化后重复的图书馆路径，请先删除重复项后重试'}), 409

    normalized_changed = False
    for normalized, items in normalized_map.items():
        item = items[0]
        if normalized != item.path:
            item.path = normalized
            normalized_changed = True

    if normalized_changed:
        db.session.commit()
    
    # 检查是否存在任何活跃扫描任务
    active_tasks = Task.query.filter_by(task_type='scan').filter(Task.status.in_(['pending', 'running'])).all()
    
    if active_tasks:
        return jsonify({
            'error': '当前存在运行中的扫描任务，请等待完成后再试',
            'active_tasks': [task.to_dict() for task in active_tasks]
        }), 409

    tasks = []
    for p in paths:
        # 创建任务记录
        task_record = Task(
            name=f'扫描路径: {p.path}',
            task_type='scan',
            target_path=p.path,
            target_library_path_id=p.id,
            status='pending'
        )
        db.session.add(task_record)
        db.session.commit()
        
        # 投递后台任务（Huey）
        task = start_scan_task(p.id, task_db_id=task_record.id)
        
        # 回写 Huey 任务 ID
        task_record.task_id = task.id
        db.session.commit()
        
        tasks.append({
            'path': p.path, 
            'task_id': task.id,
            'db_task_id': task_record.id
        })
        
    return jsonify({'message': '已开始扫描全部图书馆路径', 'tasks': tasks}), 202

# 预留：后续图书馆相关接口（按设计文档补齐）
@api.route('/library/sync-report', methods=['GET'])
def get_sync_report():
    # TODO：实现同步报告逻辑
    return jsonify({'message': '同步报告功能尚未实现'}) 
