from flask import request, jsonify
from . import api
from ... import db
from ...models import Like, File
from .files import file_to_dict

@api.route('/likes', methods=['GET'])
def get_likes():
    """返回全部“喜欢”的文件列表。"""
    items = Like.query.order_by(Like.added_at.desc()).all()
    # Return full file details for each liked item
    files = [file_to_dict(item.file, is_liked=True) for item in items if item.file and not item.file.is_missing]
    return jsonify(files)

@api.route('/likes/<int:file_id>', methods=['PUT'])
def add_to_likes(file_id):
    """将指定文件加入“喜欢”（幂等）。"""
    file_record = db.session.get(File, file_id)
    if not file_record:
        return jsonify({'error': '文件不存在'}), 404
    
    existing = Like.query.filter_by(file_id=file_id).first()
    if existing:
        return jsonify({'message': '已在喜欢列表中'}), 200

    new_item = Like(file_id=file_id)
    db.session.add(new_item)
    db.session.commit()
    
    return jsonify({'message': '已加入喜欢列表'}), 201

@api.route('/likes/<int:file_id>', methods=['DELETE'])
def remove_from_likes(file_id):
    """将指定文件移出“喜欢”（幂等）。"""
    item = Like.query.filter_by(file_id=file_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    
    return '', 204 
