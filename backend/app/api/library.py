from flask import request, jsonify
from . import api
from .. import huey, socketio
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
    
    # Dispatch the background task
    task = start_scan_task(path)
    
    return jsonify({'message': 'Scan started', 'task_id': task.id}), 202

# Placeholder for other library-related endpoints from the design doc
@api.route('/library/sync-report', methods=['GET'])
def get_sync_report():
    # TODO: Implement sync report logic
    return jsonify({'message': 'Sync report placeholder'}) 