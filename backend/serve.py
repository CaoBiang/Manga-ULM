import eventlet
eventlet.monkey_patch()

from main import app
from app import socketio

if __name__ == '__main__':
    socketio.run(app) 