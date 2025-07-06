from flask import Blueprint

api = Blueprint('api', __name__, url_prefix='/api/v1')

# Import API endpoints here to register them
from . import backup, covers, files, library, maintenance, rename, settings, tag_types, tags, tasks, wishlist, library_paths, bookmarks