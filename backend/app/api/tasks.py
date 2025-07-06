from flask import jsonify
from . import api
from .. import huey

@api.route('/tasks/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """
    Get the status of a background task.
    """
    # NOTE: Huey doesn't have a built-in status like Celery. 
    # A robust implementation requires writing the status to our own `tasks` table in the database
    # from within the task itself. This is a simplified placeholder.
    
    task_result = huey.result(task_id, peek=True)

    if task_result is None:
        # Task is either pending, running, or has no return value.
        # We need a proper state machine in the DB for a real status.
        return jsonify({'status': 'pending_or_running'})

    if isinstance(task_result, Exception):
        return jsonify({'status': 'failed', 'error': str(task_result)})

    return jsonify({'status': 'completed', 'result': task_result}) 