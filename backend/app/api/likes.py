from flask import request, jsonify
from . import api
from .. import db
from ..models import Like, File
from .files import file_to_dict

@api.route('/likes', methods=['GET'])
def get_likes():
    """Returns all items in the liked list."""
    items = Like.query.order_by(Like.added_at.desc()).all()
    # Return full file details for each liked item
    files = [file_to_dict(item.file, is_liked=True) for item in items if item.file and not item.file.is_missing]
    return jsonify(files)

@api.route('/likes/<int:file_id>', methods=['POST'])
def add_to_likes(file_id):
    """Adds a file to the liked list."""
    file = db.session.get(File, file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    existing = Like.query.filter_by(file_id=file_id).first()
    if existing:
        return jsonify({'message': 'File is already in the liked list'}), 200

    new_item = Like(file_id=file_id)
    db.session.add(new_item)
    db.session.commit()
    
    return jsonify({'message': 'File added to liked list'}), 201

@api.route('/likes/<int:file_id>', methods=['DELETE'])
def remove_from_likes(file_id):
    """Removes a file from the liked list."""
    item = Like.query.filter_by(file_id=file_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    
    return '', 204 