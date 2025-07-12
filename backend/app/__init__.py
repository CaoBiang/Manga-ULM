import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS
from huey import SqliteHuey
from config import config

# Manually create the instance directory before initializing anything that needs it.
# This is necessary because some extensions like Huey are initialized at import time,
# before the app factory has a chance to create the directory.
instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance')
os.makedirs(instance_path, exist_ok=True)

db = SQLAlchemy()
socketio = SocketIO()
# According to the design, we use Huey with SQLite backend
# The database file will be created inside the instance folder
huey = SqliteHuey(filename=os.path.join(instance_path, 'tasks.db'))

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    db.init_app(app)
    socketio.init_app(app, async_mode='eventlet', cors_allowed_origins="*")
    CORS(app, resources={r"/api/*": {"origins": "*"}}) # Allow CORS for API endpoints

    # Register blueprints here
    from .api import api as api_blueprint
    app.register_blueprint(api_blueprint, url_prefix='/api/v1')

    # Import tasks to register them with Huey
    from . import tasks

    return app 