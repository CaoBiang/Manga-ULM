import eventlet

eventlet.monkey_patch()

from main import app
from app import socketio

if __name__ == "__main__":
    # socketio.run(app)
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
