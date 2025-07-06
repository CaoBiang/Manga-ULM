from flask import send_from_directory, current_app, abort
import os
from . import api

@api.route('/covers/<path:filename>')
def get_cover(filename):
    """Serves a cover image from the cache directory."""
    cover_cache_path = current_app.config['COVER_CACHE_PATH']
    
    # Security: Ensure the filename is safe and doesn't traverse directories.
    if '..' in filename or filename.startswith('/'):
        abort(400)
        
    if not os.path.exists(os.path.join(cover_cache_path, filename)):
        # You could return a default placeholder image here instead of a 404
        abort(404)

    return send_from_directory(cover_cache_path, filename) 