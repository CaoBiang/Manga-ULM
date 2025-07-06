from flask import request, jsonify
from . import api
from ..tasks.rename import batch_rename_task

@api.route('/rename/batch', methods=['POST'])
def batch_rename():
    """
    Kicks off a batch rename task based on a template and file IDs.
    """
    data = request.get_json()
    if not data or not data.get('template') or not data.get('file_ids') or not data.get('root_path'):
        return jsonify({'error': 'template, file_ids, and root_path are required'}), 400

    template = data['template']
    file_ids = data['file_ids']
    root_path = data['root_path']

    if not isinstance(file_ids, list):
        return jsonify({'error': 'file_ids must be a list'}), 400

    # Start the background task
    task = batch_rename_task(file_ids, template, root_path)
    
    return jsonify({'task_id': task.id}), 202 