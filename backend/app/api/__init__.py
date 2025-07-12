from flask import Blueprint

api = Blueprint('api', __name__)

# Import all route modules to register them with the blueprint
from . import backup, bookmarks, covers, files, library_paths, library, likes, maintenance, rename, settings, tag_types, tags, tasks

# Socket.IO事件处理
from .. import socketio

@socketio.on('test_event')
def handle_test_event(data):
    print(f"Received test event: {data}")
    socketio.emit('test_response', {'status': 'success', 'message': 'Socket.IO working properly'})