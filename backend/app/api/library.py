from flask import request, jsonify
from . import api
from .. import huey, socketio
from ..models.manga import Config
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
    
    # Get max workers from config, with a default value
    max_workers_setting = Config.query.get('scan.max_workers')
    if max_workers_setting and max_workers_setting.value.isdigit():
        max_workers = int(max_workers_setting.value)
    else:
        max_workers = 12 # Default value
    
    # Dispatch the background task
    task = start_scan_task(path, max_workers=max_workers)
    
    return jsonify({'message': 'Scan started', 'task_id': task.id}), 202

# Placeholder for other library-related endpoints from the design doc
@api.route('/library/sync-report', methods=['GET'])
def get_sync_report():
    # TODO: Implement sync report logic
    return jsonify({'message': 'Sync report placeholder'}) 