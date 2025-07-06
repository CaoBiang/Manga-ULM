import os
import shutil
import datetime
from flask import request, jsonify, current_app
from . import api

def get_backup_dir():
    """Gets the backup directory from app config, ensuring it exists."""
    # The backup path should be configured in config.py, e.g., os.path.join(INSTANCE_PATH, 'backups')
    backup_path = current_app.config.get('BACKUP_PATH')
    if not backup_path:
        raise ValueError("BACKUP_PATH is not configured in the application.")
    os.makedirs(backup_path, exist_ok=True)
    return backup_path

def get_db_path():
    """Gets the main database file path."""
    db_path = current_app.config.get('SQLALCHEMY_DATABASE_URI')
    if not db_path or not db_path.startswith('sqlite:///'):
        raise ValueError("Database is not a local SQLite file or is not configured.")
    return db_path.replace('sqlite:///', '')


@api.route('/backup/now', methods=['POST'])
def backup_now():
    """Creates an immediate backup of the database file."""
    try:
        backup_dir = get_backup_dir()
        db_path = get_db_path()

        timestamp = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        backup_filename = f'manga_manager_backup_{timestamp}.db'
        backup_filepath = os.path.join(backup_dir, backup_filename)
        
        shutil.copy2(db_path, backup_filepath)
        
        return jsonify({'message': f'Backup created successfully: {backup_filename}'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/backup/list', methods=['GET'])
def list_backups():
    """Lists all available backup files."""
    try:
        backup_dir = get_backup_dir()
        backups = [f for f in os.listdir(backup_dir) if f.endswith('.db') and f.startswith('manga_manager_backup_')]
        backups.sort(reverse=True) # Show newest first
        return jsonify(backups)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
@api.route('/backup/restore', methods=['POST'])
def restore_backup():
    """Restores the database from a given backup file."""
    data = request.get_json()
    if not data or not data.get('filename'):
        return jsonify({'error': 'Backup filename is required.'}), 400
    
    filename = data['filename']
    # Security check: ensure filename is not malicious
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': 'Invalid filename.'}), 400

    try:
        backup_dir = get_backup_dir()
        db_path = get_db_path()
        
        backup_filepath = os.path.join(backup_dir, filename)
        
        if not os.path.exists(backup_filepath):
            return jsonify({'error': 'Backup file not found.'}), 404
            
        # Here you might want to stop the main app/db access before copying
        # For a simple desktop app, this might be acceptable, but in a real server,
        # you'd need a more robust mechanism (e.g., maintenance mode).
        
        shutil.copy2(backup_filepath, db_path)
        
        return jsonify({'message': f'Successfully restored database from {filename}. Please restart the application for changes to take effect.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500 