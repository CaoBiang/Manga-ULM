from flask import request, jsonify
from . import api
from ... import db
from ...models import TagType

@api.route('/tag-types', methods=['GET'])
def get_tag_types():
    """返回全部标签类型列表。"""
    types = TagType.query.order_by(TagType.sort_order, TagType.id).all()
    return jsonify([{'id': t.id, 'name': t.name, 'sort_order': t.sort_order} for t in types])

@api.route('/tag-types', methods=['POST'])
def create_tag_type():
    """创建新的标签类型。"""
    data = request.get_json(silent=True) or {}
    name = str(data.get('name') or '').strip()
    if not name:
        return jsonify({'error': '必须提供 name'}), 400
    
    new_type = TagType(name=name, sort_order=data.get('sort_order', 0))
    db.session.add(new_type)
    db.session.commit()
    return jsonify({'id': new_type.id, 'name': new_type.name, 'sort_order': new_type.sort_order}), 201

@api.route('/tag-types/<int:id>', methods=['PUT'])
def update_tag_type(id):
    """更新指定标签类型。"""
    tag_type = db.session.get(TagType, id)
    if not tag_type:
        return jsonify({'error': '标签类型不存在'}), 404
        
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': '请求体不能为空'}), 400

    if 'name' in data:
        tag_type.name = str(data['name']).strip()
    if 'sort_order' in data:
        tag_type.sort_order = data['sort_order']
        
    db.session.commit()
    return jsonify({'id': tag_type.id, 'name': tag_type.name, 'sort_order': tag_type.sort_order})

@api.route('/tag-types/<int:id>', methods=['DELETE'])
def delete_tag_type(id):
    """删除指定标签类型。"""
    tag_type = db.session.get(TagType, id)
    if not tag_type:
        return jsonify({'error': '标签类型不存在'}), 404
        
    # 删除前检查：若仍被标签引用则拒绝
    if tag_type.tags.first():
        return jsonify({'error': '该标签类型正在被标签使用，无法删除'}), 400
        
    db.session.delete(tag_type)
    db.session.commit()
    return '', 204 
