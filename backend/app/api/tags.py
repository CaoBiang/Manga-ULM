import re
from flask import request, jsonify
from . import api
from .. import db
from ..models import Tag, TagType, TagAlias, File
from ..tasks.rename import tag_file_change_task, tag_split_task

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
    query = Tag.query.order_by(Tag.name)
    type_id = request.args.get('type_id')
    if type_id and type_id != 'all':
        query = query.filter_by(type_id=int(type_id))

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    tags = pagination.items
    
    return jsonify({
        'tags': [tag_to_dict(t) for t in tags],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })

@api.route('/tags/all', methods=['GET'])
def get_all_tags():
    tags = Tag.query.order_by(Tag.name).all()
    return jsonify([tag_to_dict(t) for t in tags])

@api.route('/tags', methods=['POST'])
def create_tag():
    data = request.get_json()
    print(f"Creating tag with data: {data}")
    if not data or not data.get('name') or not data.get('type_id'):
        return jsonify({'error': 'Name and type_id are required'}), 400
    
    tag = Tag(
        name=data['name'],
        type_id=data['type_id'],
        parent_id=data.get('parent_id'),
        description=data.get('description')
    )
    db.session.add(tag)
    db.session.flush()  # 获取tag的ID
    print(f"Created tag with ID: {tag.id}")
    
    # 添加别名
    if 'aliases' in data and isinstance(data['aliases'], list):
        print(f"Processing aliases: {data['aliases']}")
        for alias_name in data['aliases']:
            if alias_name and alias_name.strip():
                alias = TagAlias(tag_id=tag.id, alias_name=alias_name.strip())
                db.session.add(alias)
                print(f"Added alias: {alias_name.strip()}")
    
    db.session.commit()
    result = tag_to_dict(tag)
    print(f"Returning tag: {result}")
    return jsonify(result), 201

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
    print(f"Updating tag {id} with data: {data}")
    if not data:
        return jsonify({'error': 'Request body cannot be empty'}), 400
    
    # Update tag properties
    tag.name = data.get('name', tag.name)
    tag.type_id = data.get('type_id', tag.type_id)
    tag.parent_id = data.get('parent_id', tag.parent_id)
    tag.description = data.get('description', tag.description)
    
    # Atomically update aliases
    if 'aliases' in data and isinstance(data['aliases'], list):
        print(f"Processing aliases update: {data['aliases']}")
        # Get new and old alias sets
        new_aliases = set(data['aliases'])
        old_aliases = {a.alias_name for a in tag.aliases}
        print(f"Old aliases: {old_aliases}")
        print(f"New aliases: {new_aliases}")

        # Find which to add and which to remove
        to_add = new_aliases - old_aliases
        to_remove = old_aliases - new_aliases
        print(f"Aliases to add: {to_add}")
        print(f"Aliases to remove: {to_remove}")

        # Remove old ones
        if to_remove:
            TagAlias.query.filter(TagAlias.tag_id == id, TagAlias.alias_name.in_(to_remove)).delete(synchronize_session=False)

        # Add new ones
        for alias_name in to_add:
            db.session.add(TagAlias(tag_id=id, alias_name=alias_name))
            print(f"Added alias: {alias_name}")
    
    db.session.commit()
    result = tag_to_dict(tag)
    print(f"Updated tag result: {result}")
    return jsonify(result)

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

@api.route('/tags/<int:tag_id>/file-change', methods=['POST'])
def change_tag_in_files(tag_id):
    """
    修改所有文件名中的指定标签：删除或重命名
    """
    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    
    data = request.get_json()
    if not data or not data.get('action'):
        return jsonify({'error': 'action is required'}), 400
    
    action = data['action']  # 'delete' or 'rename'
    
    if action not in ['delete', 'rename']:
        return jsonify({'error': 'action must be delete or rename'}), 400
    
    if action == 'rename':
        new_name = data.get('new_name')
        if not new_name:
            return jsonify({'error': 'new_name is required for rename action'}), 400
    else:
        new_name = None
    
    # 开始后台任务
    try:
        task = tag_file_change_task(tag_id, action, new_name)
        print(f"Started tag file change task with ID: {task.id}")
        return jsonify({'task_id': task.id}), 202
    except Exception as e:
        print(f"Failed to start tag file change task: {e}")
        return jsonify({'error': f'Failed to start task: {str(e)}'}), 500 

@api.route('/tags/<int:tag_id>/split', methods=['POST'])
def split_tag(tag_id):
    """
    拆分标签：将一个标签拆分成多个同类型标签
    """
    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    
    data = request.get_json()
    if not data or not data.get('new_tag_names'):
        return jsonify({'error': 'new_tag_names is required'}), 400
    
    new_tag_names = data['new_tag_names']
    
    # 验证新标签名称列表
    if not isinstance(new_tag_names, list) or len(new_tag_names) == 0:
        return jsonify({'error': 'new_tag_names must be a non-empty list'}), 400
    
    # 验证新标签名称不为空
    for tag_name in new_tag_names:
        if not tag_name or not tag_name.strip():
            return jsonify({'error': 'Tag names cannot be empty'}), 400
    
    # 去重和清理
    new_tag_names = list(set(name.strip() for name in new_tag_names))
    
    # 开始后台任务
    try:
        task = tag_split_task(tag_id, new_tag_names)
        print(f"Started tag split task with ID: {task.id}")
        return jsonify({'task_id': task.id}), 202
    except Exception as e:
        print(f"Failed to start tag split task: {e}")
        return jsonify({'error': f'Failed to start task: {str(e)}'}), 500 