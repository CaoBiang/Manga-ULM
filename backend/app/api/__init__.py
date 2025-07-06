from flask import Blueprint

api = Blueprint('api', __name__)

# Import the routes to register them with the blueprint
from . import library, tasks, files, tags, maintenance, covers, tag_types, wishlist, rename, backup 