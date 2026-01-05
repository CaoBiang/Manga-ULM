from flask import jsonify, request

from . import api
from ... import db
from ...models.manga import LibraryPath, Task
from ...tasks.scanner import start_scan_task
from ...services.path_service import normalize_library_path

@api.route('/scan-jobs', methods=['POST'])
def create_scan_jobs():
    """
    创建扫描任务（异步 Huey 任务 + 数据库 Task 记录）。

    支持三种模式：
    - 扫描单个图书馆路径：{"library_path_id": 1}
    - 扫描多个图书馆路径：{"library_path_ids": [1,2,3]}
    - 扫描全部图书馆路径：{"all": true}（或空请求体）
    """
    payload = request.get_json(silent=True) or {}
    raw_library_path_id = payload.get('library_path_id', None)
    raw_library_path_ids = payload.get('library_path_ids', None)

    selected_ids = []
    if raw_library_path_id is not None:
        if isinstance(raw_library_path_id, bool):
            return jsonify({'error': 'library_path_id 必须为整数'}), 400
        try:
            selected_ids = [int(raw_library_path_id)]
        except (TypeError, ValueError):
            return jsonify({'error': 'library_path_id 必须为整数'}), 400
    elif raw_library_path_ids is not None:
        if not isinstance(raw_library_path_ids, list) or not raw_library_path_ids:
            return jsonify({'error': 'library_path_ids 必须为非空数组'}), 400
        try:
            selected_ids = [int(x) for x in raw_library_path_ids if not isinstance(x, bool)]
        except (TypeError, ValueError):
            return jsonify({'error': 'library_path_ids 必须为整数数组'}), 400
        if len(selected_ids) != len(raw_library_path_ids):
            return jsonify({'error': 'library_path_ids 必须为整数数组'}), 400

    if selected_ids:
        library_paths = LibraryPath.query.filter(LibraryPath.id.in_(selected_ids)).all()
        found_ids = {p.id for p in library_paths}
        missing = [pid for pid in selected_ids if pid not in found_ids]
        if missing:
            return jsonify({'error': '图书馆路径不存在', 'missing_ids': missing}), 404
    else:
        # 默认：扫描全部图书馆路径
        library_paths = LibraryPath.query.all()

    if not library_paths:
        return jsonify({'error': '尚未配置图书馆路径'}), 400

    # 扫描前统一归一化路径，避免后台任务看不到映射盘符导致扫描为空。
    normalized_map = {}
    normalized_candidates = {}
    for p in library_paths:
        normalized = normalize_library_path(p.path)
        normalized_map.setdefault(normalized, []).append(p)
        normalized_candidates[p.id] = normalized

    duplicates = {k: v for k, v in normalized_map.items() if len(v) > 1}
    if duplicates:
        return jsonify({'error': '检测到归一化后重复的图书馆路径，请先删除重复项后重试'}), 409

    normalized_changed = False
    for p in library_paths:
        normalized = normalized_candidates.get(p.id, p.path)
        if normalized != p.path:
            conflict = LibraryPath.query.filter(LibraryPath.path == normalized, LibraryPath.id != p.id).first()
            if conflict:
                return jsonify({'error': '路径归一化后与现有图书馆路径重复，请删除重复项后重试'}), 409
            p.path = normalized
            normalized_changed = True

    if normalized_changed:
        db.session.commit()
    
    # 检查是否存在活跃扫描任务
    active_query = Task.query.filter_by(task_type='scan').filter(Task.status.in_(['pending', 'running']))
    if selected_ids:
        active_query = active_query.filter(Task.target_library_path_id.in_(selected_ids))
        active_tasks = active_query.all()
        if active_tasks:
            return jsonify({
                'error': '所选路径存在运行中的扫描任务，请等待完成后重试',
                'active_tasks': [task.to_dict() for task in active_tasks]
            }), 409
    else:
        active_tasks = active_query.all()
        if active_tasks:
            return jsonify({
                'error': '当前存在运行中的扫描任务，请等待完成后再试',
                'active_tasks': [task.to_dict() for task in active_tasks]
            }), 409

    created_tasks = []
    for p in library_paths:
        task_record = Task(
            name=f'扫描路径: {p.path}',
            task_type='scan',
            target_path=p.path,
            target_library_path_id=p.id,
            status='pending'
        )
        db.session.add(task_record)
        db.session.commit()

        task = start_scan_task(p.id, task_db_id=task_record.id)
        task_record.task_id = task.id
        db.session.commit()

        created_tasks.append(task_record.to_dict())

    return jsonify({
        'message': '已创建扫描任务',
        'tasks': created_tasks,
        'count': len(created_tasks),
    }), 202

# 预留：后续图书馆相关接口（按设计文档补齐）
@api.route('/sync-reports', methods=['GET'])
def get_sync_report():
    # TODO：实现同步报告逻辑
    return jsonify({'message': '同步报告功能尚未实现'}) 
