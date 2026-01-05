import os
import shutil
import datetime
from flask import request, jsonify, current_app
from . import api
from ...services.task_service import create_task_record, fail_task, finish_task, mark_task_running, update_task_progress

def get_backup_dir(*, ensure_exists: bool = True) -> str:
    """从应用配置中获取备份目录。"""
    backup_path = current_app.config.get('BACKUP_PATH')
    if not backup_path:
        raise ValueError('未配置 BACKUP_PATH（备份目录）')
    if ensure_exists:
        os.makedirs(backup_path, exist_ok=True)
    return backup_path

def get_db_path():
    """获取主数据库文件路径。"""
    db_path = current_app.config.get('SQLALCHEMY_DATABASE_URI')
    if not db_path or not db_path.startswith('sqlite:///'):
        raise ValueError('数据库不是本地 SQLite 文件，或未正确配置')
    return db_path.replace('sqlite:///', '')


def validate_backup_filename(filename: str) -> str:
    """校验并返回合法的备份文件名（仅允许 basename）。"""
    raw = str(filename or '').strip()
    if not raw:
        raise ValueError('必须提供 filename（备份文件名）')
    if os.path.basename(raw) != raw:
        raise ValueError('非法文件名')
    if '..' in raw or '/' in raw or '\\' in raw:
        raise ValueError('非法文件名')
    if not raw.startswith('manga_manager_backup_') or not raw.endswith('.db'):
        raise ValueError('非法备份文件名')
    return raw


@api.route('/backups', methods=['POST'])
def create_backup():
    """创建数据库备份（同步执行，但会记录到任务管理器）。"""
    task_record = None
    try:
        backup_dir = get_backup_dir()
        db_path = get_db_path()

        timestamp = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        backup_filename = f'manga_manager_backup_{timestamp}.db'
        backup_filepath = os.path.join(backup_dir, backup_filename)

        task_record = create_task_record(
            name=f'创建备份: {backup_filename}',
            task_type='backup',
            status='pending',
            target_path=backup_dir,
            total_files=1,
            processed_files=0,
            progress=0.0,
            current_file=backup_filename,
        )
        mark_task_running(task_record, current_file=backup_filename, total_files=1, processed_files=0)

        shutil.copy2(db_path, backup_filepath)
        update_task_progress(task_record, processed_files=1, total_files=1, current_file=backup_filename)
        finish_task(task_record, status='completed')

        return jsonify({
            'message': '备份创建成功',
            'backup_filename': backup_filename,
            'db_task_id': task_record.id
        }), 201
    except Exception as e:
        if task_record:
            fail_task(task_record, error_message=f'创建备份失败: {str(e)}')
        return jsonify({'error': str(e)}), 500

@api.route('/backups', methods=['GET'])
def list_backups():
    """列出所有可用备份文件。"""
    try:
        backup_dir = get_backup_dir(ensure_exists=False)
        if not os.path.isdir(backup_dir):
            return jsonify({'backups': [], 'count': 0})

        backups = []
        for filename in os.listdir(backup_dir):
            if not (filename.endswith('.db') and filename.startswith('manga_manager_backup_')):
                continue
            full_path = os.path.join(backup_dir, filename)
            try:
                stat = os.stat(full_path)
                backups.append({
                    'filename': filename,
                    'size': int(stat.st_size),
                    'mtime': int(stat.st_mtime),
                })
            except OSError:
                continue

        backups.sort(key=lambda x: x.get('mtime', 0), reverse=True)  # 最新的在前
        return jsonify({'backups': backups, 'count': len(backups)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
@api.route('/backup-restores', methods=['POST'])
def create_backup_restore():
    """从指定备份文件还原数据库（同步执行，但会记录到任务管理器）。"""
    data = request.get_json(silent=True) or {}
    
    try:
        filename = validate_backup_filename(data.get('filename'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    task_record = create_task_record(
        name=f'还原备份: {filename}',
        task_type='backup',
        status='pending',
        target_path=filename,
        total_files=1,
        processed_files=0,
        progress=0.0,
        current_file=filename,
    )

    try:
        backup_dir = get_backup_dir()
        db_path = get_db_path()
        
        backup_filepath = os.path.join(backup_dir, filename)
        
        if not os.path.exists(backup_filepath):
            fail_task(task_record, error_message='备份文件不存在')
            return jsonify({'error': '备份文件不存在'}), 404

        mark_task_running(task_record, current_file=filename, total_files=1, processed_files=0, target_path=backup_filepath)
        shutil.copy2(backup_filepath, db_path)
        update_task_progress(task_record, processed_files=1, total_files=1, current_file=filename)
        finish_task(task_record, status='completed')

        return jsonify({
            'message': '还原完成，请重启应用以生效',
            'db_task_id': task_record.id
        })
    except Exception as e:
        fail_task(task_record, error_message=f'还原备份失败: {str(e)}')
        return jsonify({'error': str(e)}), 500 
