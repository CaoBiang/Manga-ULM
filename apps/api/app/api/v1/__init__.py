from flask import Blueprint

api = Blueprint('api', __name__)

# 导入路由模块以完成注册
from . import backup, bookmarks, covers, files, library_paths, library, likes, maintenance, rename, settings, tag_types, tags, tasks
