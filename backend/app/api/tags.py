import re
from flask import request, jsonify
from . import api
from .. import db
from ..models import Tag, TagType, TagAlias, File, FileTagMap
from ..tasks.rename import tag_file_change_task, tag_split_task
from sqlalchemy import func, or_


def _usage_counts_for(tag_ids):
    if not tag_ids:
        return {}
    rows = (
        db.session.query(FileTagMap.tag_id, func.count(FileTagMap.file_id))
        .filter(FileTagMap.tag_id.in_(tag_ids))
        .group_by(FileTagMap.tag_id)
        .all()
    )
    return {tag_id: count for tag_id, count in rows}


def _children_counts_for(tag_ids):
    if not tag_ids:
        return {}
    rows = (
        db.session.query(Tag.parent_id, func.count(Tag.id))
        .filter(Tag.parent_id.in_(tag_ids))
        .group_by(Tag.parent_id)
        .all()
    )
    return {parent_id: count for parent_id, count in rows}


def tag_to_dict(tag, usage_counts=None, children_counts=None):
    usage_map = usage_counts if usage_counts is not None else _usage_counts_for([tag.id])
    children_map = children_counts if children_counts is not None else _children_counts_for([tag.id])
    return {
        'id': tag.id,
        'name': tag.name,
        'description': tag.description,
        'type_id': tag.type_id,
        'parent_id': tag.parent_id,
        'aliases': [a.alias_name for a in tag.aliases],
        'usage_count': int(usage_map.get(tag.id, 0) or 0),
        'children_count': int(children_map.get(tag.id, 0) or 0)
    }

# GET all tags (with optional filtering) and POST a new tag
@api.route('/tags', methods=['GET'])
def get_tags():
    """List tags with optional filtering, search, and pagination.
    Query params:
      - type_id: int
      - parent_id: int
      - q: search keyword (matches name or aliases)
      - page: int (default 1)
      - per_page: int (default 20)
      - sort: 'name' (default)
      - order: 'asc'|'desc' (default 'asc')
    """
    query = Tag.query

    type_id = request.args.get('type_id', type=int)
    if type_id is not None:
        query = query.filter(Tag.type_id == type_id)

    parent_id = request.args.get('parent_id', type=int)
    if parent_id is not None:
        query = query.filter(Tag.parent_id == parent_id)

    q = request.args.get('q', type=str)
    if q:
        # left join aliases and filter by either
        query = query.outerjoin(TagAlias, TagAlias.tag_id == Tag.id).filter(
            or_(Tag.name.ilike(f"%{q}%"), TagAlias.alias_name.ilike(f"%{q}%"))
        ).distinct()

    sort = (request.args.get('sort') or 'name').lower()
    order = (request.args.get('order') or 'asc').lower()
    if sort == 'name':
        sort_col = Tag.name.asc() if order == 'asc' else Tag.name.desc()
        query = query.order_by(sort_col)
    else:
        # default fallback
        query = query.order_by(Tag.name.asc())

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    tags = pagination.items
    tag_ids = [t.id for t in tags]
    usage_counts = _usage_counts_for(tag_ids)
    children_counts = _children_counts_for(tag_ids)

    return jsonify({
        'tags': [tag_to_dict(t, usage_counts, children_counts) for t in tags],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })

@api.route('/tags/all', methods=['GET'])
def get_all_tags():
    tags = Tag.query.order_by(Tag.name).all()
    tag_ids = [t.id for t in tags]
    usage_counts = _usage_counts_for(tag_ids)
    children_counts = _children_counts_for(tag_ids)
    return jsonify([tag_to_dict(t, usage_counts, children_counts) for t in tags])

@api.route('/tags/suggest', methods=['GET'])
def suggest_tags():
    """Lightweight tag suggestions for remote selects.
    Query params: q, type_id, limit (default 20)
    """
    q = request.args.get('q', type=str)
    type_id = request.args.get('type_id', type=int)
    limit = request.args.get('limit', 20, type=int)

    query = Tag.query
    if type_id is not None:
        query = query.filter(Tag.type_id == type_id)
    if q:
        query = query.outerjoin(TagAlias, TagAlias.tag_id == Tag.id).filter(
            or_(Tag.name.ilike(f"%{q}%"), TagAlias.alias_name.ilike(f"%{q}%"))
        ).distinct()
    query = query.order_by(Tag.name.asc()).limit(limit)

    tag_list = query.all()
    tag_ids = [t.id for t in tag_list]
    usage_counts = _usage_counts_for(tag_ids)
    results = [
        {
            'id': t.id,
            'name': t.name,
            'type_id': t.type_id,
            'usage_count': int(usage_counts.get(t.id, 0) or 0)
        }
        for t in tag_list
    ]
    return jsonify(results)

@api.route('/tags', methods=['POST'])
def create_tag():
    data = request.get_json()
    print(f"Creating tag with data: {data}")
    if not data or not data.get('name') or not data.get('type_id'):
        return jsonify({'error': 'Name and type_id are required'}), 400
    
    name = data['name'].strip()
    # uniqueness check (case-insensitive)
    exists = Tag.query.filter(Tag.name.ilike(name)).first()
    if exists:
        return jsonify({'error': 'Tag name already exists'}), 409
    
    tag = Tag(
        name=name,
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
            if not alias_name:
                continue
            alias_clean = alias_name.strip()
            if not alias_clean:
                continue
            # prevent alias conflicting with existing tag names or aliases
            if Tag.query.filter(Tag.name.ilike(alias_clean)).first():
                continue
            if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_clean)).first():
                continue
            alias = TagAlias(tag_id=tag.id, alias_name=alias_clean)
            db.session.add(alias)
            print(f"Added alias: {alias_clean}")
    
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
    
    # Update tag properties (with uniqueness check for name)
    new_name = data.get('name', tag.name)
    if new_name and new_name.strip() and new_name.strip() != tag.name:
        conflict = Tag.query.filter(Tag.name.ilike(new_name.strip()), Tag.id != id).first()
        if conflict:
            return jsonify({'error': 'Tag name already exists'}), 409
        tag.name = new_name.strip()
    tag.type_id = data.get('type_id', tag.type_id)
    tag.parent_id = data.get('parent_id', tag.parent_id)
    tag.description = data.get('description', tag.description)
    
    # Atomically update aliases
    if 'aliases' in data and isinstance(data['aliases'], list):
        print(f"Processing aliases update: {data['aliases']}")
        # Get new and old alias sets
        new_aliases = set(a.strip() for a in data['aliases'] if a and a.strip())
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
            # prevent alias conflicting with existing tags or aliases
            if Tag.query.filter(Tag.name.ilike(alias_name)).first():
                continue
            if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_name)).first():
                continue
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
    # Remove associations to avoid FK issues and keep data clean
    # 1) Remove from files
    FileTagMap.query.filter_by(tag_id=id).delete(synchronize_session=False)
    # 2) Remove aliases
    TagAlias.query.filter_by(tag_id=id).delete(synchronize_session=False)
    # 3) Remove the tag itself
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
    
    alias_name = data['alias_name'].strip()
    # conflicts
    if Tag.query.filter(Tag.name.ilike(alias_name)).first():
        return jsonify({'error': 'Alias conflicts with an existing tag name'}), 409
    if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_name)).first():
        return jsonify({'error': 'Alias already exists'}), 409
    alias = TagAlias(tag_id=id, alias_name=alias_name)
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

@api.route('/tags/<int:tag_id>/file-change/preview', methods=['POST'])
def preview_change_tag_in_files(tag_id):
    """Preview impact of deleting or renaming a tag in filenames."""
    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404

    data = request.get_json() or {}
    action = data.get('action')
    if action not in ['delete', 'rename']:
        return jsonify({'error': 'action must be delete or rename'}), 400
    new_name = data.get('new_name') if action == 'rename' else None
    if action == 'rename' and (not new_name or not new_name.strip()):
        return jsonify({'error': 'new_name is required for rename action'}), 400

    # collect patterns (name + aliases)
    patterns = [tag.name] + [a.alias_name for a in tag.aliases]
    # query files containing any pattern in [pattern]
    from sqlalchemy import or_ as _or
    filters = [File.file_path.ilike(f"%[{p}]%") for p in patterns]
    files = File.query.filter(_or(*filters)).all()
    impacted = len(files)

    examples = []
    for f in files[:10]:
        old_path = f.file_path
        new_path = old_path
        for p in patterns:
            bracket = f'[{p}]'
            if bracket in new_path:
                if action == 'delete':
                    new_path = new_path.replace(bracket, '')
                else:  # rename
                    new_path = new_path.replace(bracket, f'[{new_name}]')
        examples.append({'old': old_path, 'new': new_path})

    return jsonify({'impacted': impacted, 'examples': examples})


@api.route('/tags/<int:tag_id>/split/preview', methods=['POST'])
def preview_split_tag(tag_id):
    """Preview impact of splitting a tag."""
    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404

    data = request.get_json() or {}
    new_tag_names = data.get('new_tag_names') or []
    if not isinstance(new_tag_names, list) or not new_tag_names:
        return jsonify({'error': 'new_tag_names must be a non-empty list'}), 400

    patterns = [tag.name] + [a.alias_name for a in tag.aliases]
    from sqlalchemy import or_ as _or
    filters = [File.file_path.ilike(f"%[{p}]%") for p in patterns]
    files = File.query.filter(_or(*filters)).all()
    impacted = len(files)

    examples = []
    for f in files[:10]:
        old_path = f.file_path
        new_path = old_path
        for p in patterns:
            new_path = new_path.replace(f'[{p}]', '')
        # Append new tags at the end of filename (before extension) for preview purposes
        import os as _os
        base, ext = _os.path.splitext(new_path)
        suffix = ''.join([f'[{n}]' for n in new_tag_names])
        new_path = base + suffix + ext
        examples.append({'old': old_path, 'new': new_path})

    return jsonify({'impacted': impacted, 'examples': examples})


@api.route('/tags/<int:source_id>/merge', methods=['POST'])
def merge_tags(source_id):
    """Merge source tag into target tag: move file associations, fold aliases, delete source.
    Body: { target_tag_id: int }
    """
    src = db.session.get(Tag, source_id)
    if not src:
        return jsonify({'error': 'Source tag not found'}), 404
    data = request.get_json() or {}
    target_id = data.get('target_tag_id')
    if not target_id:
        return jsonify({'error': 'target_tag_id is required'}), 400
    if target_id == source_id:
        return jsonify({'error': 'Cannot merge a tag into itself'}), 400
    tgt = db.session.get(Tag, target_id)
    if not tgt:
        return jsonify({'error': 'Target tag not found'}), 404
    if tgt.type_id != src.type_id:
        return jsonify({'error': 'Tags must be of the same type to merge'}), 400

    try:
        # move file associations
        mappings = FileTagMap.query.filter_by(tag_id=src.id).all()
        for m in mappings:
            # ensure mapping to target exists
            exists = FileTagMap.query.filter_by(file_id=m.file_id, tag_id=tgt.id).first()
            if not exists:
                db.session.add(FileTagMap(file_id=m.file_id, tag_id=tgt.id))
        # remove old mappings
        FileTagMap.query.filter_by(tag_id=src.id).delete(synchronize_session=False)

        # fold aliases (including source name)
        existing_aliases = {a.alias_name.lower() for a in tgt.aliases}
        to_add = set()
        to_add.add(src.name)
        for a in src.aliases:
            to_add.add(a.alias_name)
        for alias_name in to_add:
            if alias_name.lower() in existing_aliases:
                continue
            if Tag.query.filter(Tag.name.ilike(alias_name)).first():
                continue
            if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_name)).first():
                continue
            db.session.add(TagAlias(tag_id=tgt.id, alias_name=alias_name))

        # finally, delete the source tag
        TagAlias.query.filter_by(tag_id=src.id).delete(synchronize_session=False)
        db.session.delete(src)
        db.session.commit()
        return jsonify({'message': 'Merged successfully', 'target': tag_to_dict(tgt)})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to merge: {str(e)}'}), 500
