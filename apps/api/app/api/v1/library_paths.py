from flask import request, jsonify
from . import api
from ... import db
from ...models import LibraryPath
import os

@api.route('/library_paths', methods=['GET'])
def get_library_paths():
    """Returns a list of all library paths."""
    paths = LibraryPath.query.order_by(LibraryPath.path).all()
    return jsonify([{'id': p.id, 'path': p.path} for p in paths])

@api.route('/library_paths', methods=['POST'])
def add_library_path():
    """Adds a new library path."""
    data = request.get_json()
    path = data.get('path')
    if not path or not os.path.isdir(path):
        return jsonify({'error': 'A valid directory path is required'}), 400
    
    if LibraryPath.query.filter_by(path=path).first():
        return jsonify({'error': 'Path already exists in the library'}), 409
    
    new_path = LibraryPath(path=path)
    db.session.add(new_path)
    db.session.commit()
    return jsonify({'id': new_path.id, 'path': new_path.path}), 201

@api.route('/library_paths/<int:id>', methods=['DELETE'])
def delete_library_path(id):
    """Deletes a library path."""
    path_to_delete = db.session.get(LibraryPath, id)
    if not path_to_delete:
        return jsonify({'error': 'Path not found'}), 404
    
    db.session.delete(path_to_delete)
    db.session.commit()
    return '', 204 