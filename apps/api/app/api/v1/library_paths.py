from flask import request, jsonify
from . import api
from ... import db
from ...models import LibraryPath
import os

from ...services.path_service import normalize_library_path


@api.route('/library-paths', methods=['GET'])
def get_library_paths():
    """返回所有图书馆路径。"""
    paths = LibraryPath.query.order_by(LibraryPath.path).all()
    return jsonify([{'id': p.id, 'path': p.path} for p in paths])

@api.route('/library-paths', methods=['POST'])
def add_library_path():
    """新增图书馆路径。"""
    data = request.get_json() or {}
    raw_path = str(data.get('path') or '').strip()
    if not raw_path:
        return jsonify({'error': '必须提供路径'}), 400

    path = normalize_library_path(raw_path)
    if not os.path.isdir(path):
        return jsonify({'error': '路径无效或不是目录'}), 400
    
    if LibraryPath.query.filter_by(path=path).first():
        return jsonify({'error': '该路径已存在'}), 409
    
    new_path = LibraryPath(path=path)
    db.session.add(new_path)
    db.session.commit()
    return jsonify({'id': new_path.id, 'path': new_path.path}), 201

@api.route('/library-paths/<int:id>', methods=['DELETE'])
def delete_library_path(id):
    """删除图书馆路径。"""
    path_to_delete = db.session.get(LibraryPath, id)
    if not path_to_delete:
        return jsonify({'error': '路径不存在'}), 404
    
    db.session.delete(path_to_delete)
    db.session.commit()
    return '', 204 
