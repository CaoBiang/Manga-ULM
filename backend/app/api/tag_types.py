from flask import request, jsonify
from . import api
from .. import db
from ..models import TagType

@api.route('/tag_types', methods=['GET'])
def get_tag_types():
    """Returns a list of all tag types."""
    types = TagType.query.order_by(TagType.sort_order).all()
    return jsonify([{'id': t.id, 'name': t.name, 'sort_order': t.sort_order} for t in types])

@api.route('/tag_types', methods=['POST'])
def create_tag_type():
    """Creates a new tag type."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    new_type = TagType(name=data['name'], sort_order=data.get('sort_order', 0))
    db.session.add(new_type)
    db.session.commit()
    return jsonify({'id': new_type.id, 'name': new_type.name, 'sort_order': new_type.sort_order}), 201

@api.route('/tag_types/<int:id>', methods=['PUT'])
def update_tag_type(id):
    """Updates an existing tag type."""
    tag_type = db.session.get(TagType, id)
    if not tag_type:
        return jsonify({'error': 'Tag type not found'}), 404
        
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body cannot be empty'}), 400

    if 'name' in data:
        tag_type.name = data['name']
    if 'sort_order' in data:
        tag_type.sort_order = data['sort_order']
        
    db.session.commit()
    return jsonify({'id': tag_type.id, 'name': tag_type.name, 'sort_order': tag_type.sort_order})

@api.route('/tag_types/<int:id>', methods=['DELETE'])
def delete_tag_type(id):
    """Deletes a tag type."""
    tag_type = db.session.get(TagType, id)
    if not tag_type:
        return jsonify({'error': 'Tag type not found'}), 404
        
    # Optional: Check if any tags are using this type before deleting
    if tag_type.tags.first():
        return jsonify({'error': 'Cannot delete tag type as it is currently in use by tags.'}), 400
        
    db.session.delete(tag_type)
    db.session.commit()
    return '', 204 