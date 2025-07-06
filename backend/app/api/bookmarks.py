from flask import request, jsonify
from . import api
from .. import db
from ..models import Bookmark, File

def bookmark_to_dict(bookmark):
    return {
        'id': bookmark.id,
        'file_id': bookmark.file_id,
        'page_number': bookmark.page_number,
        'note': bookmark.note,
        'created_at': bookmark.created_at.isoformat()
    }

@api.route('/files/<int:file_id>/bookmarks', methods=['GET'])
def get_bookmarks(file_id):
    file = db.session.get(File, file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    bookmarks = file.bookmarks.order_by(Bookmark.page_number.asc()).all()
    return jsonify([bookmark_to_dict(b) for b in bookmarks])

@api.route('/files/<int:file_id>/bookmarks', methods=['POST'])
def add_bookmark(file_id):
    file = db.session.get(File, file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404

    data = request.get_json()
    if not data or 'page_number' not in data:
        return jsonify({'error': 'page_number is required'}), 400

    page_number = data['page_number']
    
    # Check if bookmark for this page already exists
    existing_bookmark = file.bookmarks.filter_by(page_number=page_number).first()
    if existing_bookmark:
        return jsonify({'error': 'Bookmark for this page already exists'}), 409 # 409 Conflict

    bookmark = Bookmark(
        file_id=file_id,
        page_number=page_number,
        note=data.get('note')
    )
    db.session.add(bookmark)
    db.session.commit()
    return jsonify(bookmark_to_dict(bookmark)), 201

@api.route('/bookmarks/<int:bookmark_id>', methods=['DELETE'])
def delete_bookmark(bookmark_id):
    bookmark = db.session.get(Bookmark, bookmark_id)
    if not bookmark:
        return jsonify({'error': 'Bookmark not found'}), 404
    
    db.session.delete(bookmark)
    db.session.commit()
    return '', 204 