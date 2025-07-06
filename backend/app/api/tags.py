import re
from flask import request, jsonify
from . import api
from .. import db
from ..models import Tag, TagType, TagAlias, File

def tag_to_dict(tag):
    return {
        'id': tag.id,
        'name': tag.name,
        'description': tag.description,
        'type_id': tag.type_id,
        'parent_id': tag.parent_id,
        'aliases': [a.alias_name for a in tag.aliases]
    }

# GET all tags (with optional filtering) and POST a new tag
@api.route('/tags', methods=['GET'])
def get_tags():
    query = Tag.query
    type_id = request.args.get('type_id', type=int)
    if type_id:
        query = query.filter_by(type_id=type_id)
    tags = query.all()
    return jsonify([tag_to_dict(t) for t in tags])

@api.route('/tags', methods=['POST'])
def create_tag():
    data = request.get_json()
    if not data or not data.get('name') or not data.get('type_id'):
        return jsonify({'error': 'Name and type_id are required'}), 400
    
    tag = Tag(
        name=data['name'],
        type_id=data['type_id'],
        parent_id=data.get('parent_id'),
        description=data.get('description')
    )
    db.session.add(tag)
    db.session.commit()
    return jsonify(tag_to_dict(tag)), 201

# GET, PUT, DELETE for a single tag
@api.route('/tags/<int:id>', methods=['GET'])
def get_tag(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    return jsonify(tag_to_dict(tag))

@api.route('/tags/<int:id>', methods=['PUT'])
def update_tag(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body cannot be empty'}), 400
    
    # Update tag properties
    tag.name = data.get('name', tag.name)
    tag.type_id = data.get('type_id', tag.type_id)
    tag.parent_id = data.get('parent_id', tag.parent_id)
    tag.description = data.get('description', tag.description)
    
    # Atomically update aliases
    if 'aliases' in data and isinstance(data['aliases'], list):
        # Get new and old alias sets
        new_aliases = set(data['aliases'])
        old_aliases = {a.alias_name for a in tag.aliases}

        # Find which to add and which to remove
        to_add = new_aliases - old_aliases
        to_remove = old_aliases - new_aliases

        # Remove old ones
        if to_remove:
            TagAlias.query.filter(TagAlias.tag_id == id, TagAlias.alias_name.in_(to_remove)).delete(synchronize_session=False)

        # Add new ones
        for alias_name in to_add:
            db.session.add(TagAlias(tag_id=id, alias_name=alias_name))
    
    db.session.commit()
    return jsonify(tag_to_dict(tag))

@api.route('/tags/<int:id>', methods=['DELETE'])
def delete_tag(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    
    db.session.delete(tag)
    db.session.commit()
    return '', 204

@api.route('/tags/scan-undefined-tags', methods=['GET'])
def scan_undefined_tags():
    try:
        # Get all file paths
        all_files = File.query.with_entities(File.file_path).all()
        all_paths = [item[0] for item in all_files]

        # Get all existing tag names and aliases
        all_tags = Tag.query.with_entities(Tag.name).all()
        all_aliases = TagAlias.query.with_entities(TagAlias.alias_name).all()
        existing_tags = set([item[0] for item in all_tags]) | set([item[0] for item in all_aliases])

        # Extract potential tags from brackets in file paths
        potential_tags = set()
        for path in all_paths:
            found = re.findall(r'\[([^\]]+)\]', path)
            for tag_name in found:
                potential_tags.add(tag_name.strip())

        # Find tags that are not yet defined
        undefined_tags = sorted(list(potential_tags - existing_tags))

        return jsonify(undefined_tags)
    except Exception as e:
        return jsonify(error=str(e)), 500

# Manage tag aliases
@api.route('/tags/<int:id>/aliases', methods=['POST'])
def add_tag_alias(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    data = request.get_json()
    if not data or not data.get('alias_name'):
        return jsonify({'error': 'alias_name is required'}), 400
    
    alias = TagAlias(tag_id=id, alias_name=data['alias_name'])
    db.session.add(alias)
    db.session.commit()
    return jsonify({'id': alias.id, 'alias_name': alias.alias_name}), 201

@api.route('/tags/aliases/<int:alias_id>', methods=['DELETE'])
def delete_tag_alias(alias_id):
    alias = db.session.get(TagAlias, alias_id)
    if not alias:
        return jsonify({'error': 'Alias not found'}), 404
    db.session.delete(alias)
    db.session.commit()
    return '', 204

# Apply/Remove tags from files
@api.route('/files/<int:file_id>/tags/<int:tag_id>', methods=['POST'])
def add_tag_to_file(file_id, tag_id):
    file = db.session.get(File, file_id)
    tag = db.session.get(Tag, tag_id)
    if not file or not tag:
        return jsonify({'error': 'File or Tag not found'}), 404
    
    file.tags.append(tag)
    db.session.commit()
    return jsonify({'message': 'Tag added to file successfully'})

@api.route('/files/<int:file_id>/tags/<int:tag_id>', methods=['DELETE'])
def remove_tag_from_file(file_id, tag_id):
    file = db.session.get(File, file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404
        
    tag = next((t for t in file.tags if t.id == tag_id), None)
    if tag:
        file.tags.remove(tag)
        db.session.commit()
        
    return jsonify({'message': 'Tag removed from file successfully'}) 