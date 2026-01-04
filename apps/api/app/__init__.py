import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from huey import SqliteHuey
from config import config, INSTANCE_PATH

# 运行时目录以 `config.py` 中的 INSTANCE_PATH 为唯一来源，避免出现多个 instance 目录。
os.makedirs(INSTANCE_PATH, exist_ok=True)

db = SQLAlchemy()
# 按设计使用 Huey + SQLite 作为任务队列持久化。
# 数据库文件统一放在项目根目录的 `instance/` 下。
huey = SqliteHuey(filename=os.path.join(INSTANCE_PATH, 'huey.db'))

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # 注册 HTTP API（v1）
    from .api.v1 import api as api_blueprint
    app.register_blueprint(api_blueprint, url_prefix='/api/v1')

    # 导入 tasks 以注册 Huey 任务
    from . import tasks

    return app 
