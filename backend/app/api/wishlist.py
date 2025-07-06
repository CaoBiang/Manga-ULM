from flask import request, jsonify
from . import api
from .. import db
from ..models import Wishlist, File
from .files import file_to_dict

@api.route('/wishlist', methods=['GET'])
def get_wishlist():
    """Returns all items in the wishlist."""
    items = Wishlist.query.order_by(Wishlist.added_at.desc()).all()
    # Return full file details for each wishlist item
    files = [file_to_dict(item.file) for item in items if item.file and not item.file.is_missing]
    return jsonify(files)

@api.route('/wishlist/<int:file_id>', methods=['POST'])
def add_to_wishlist(file_id):
    """Adds a file to the wishlist."""
    file = db.session.get(File, file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    existing = Wishlist.query.filter_by(file_id=file_id).first()
    if existing:
        return jsonify({'message': 'File is already in the wishlist'}), 200 # Not an error

    new_item = Wishlist(file_id=file_id)
    db.session.add(new_item)
    db.session.commit()
    
    return jsonify({'message': 'File added to wishlist'}), 201

@api.route('/wishlist/<int:file_id>', methods=['DELETE'])
def remove_from_wishlist(file_id):
    """Removes a file from the wishlist."""
    item = Wishlist.query.filter_by(file_id=file_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    
    return '', 204 