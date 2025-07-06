from flask import Blueprint

api = Blueprint('api', __name__)

# Import API endpoints here to register them
from . import library, files, tags, tag_types, rename, tasks, backup, covers, maintenance, wishlist, settings