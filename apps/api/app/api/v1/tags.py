import re
from flask import request, jsonify
from . import api
from ... import db
from ...models import Tag, TagType, TagAlias, File, FileTagMap, Task
from ...tasks.rename import tag_file_change_task, tag_split_task
from sqlalchemy import func, or_


def _normalize_color(color_value):
    """Normalize color to a safe representation.
    Accepts hex like '#RRGGBB' or named presets: red, orange, yellow, green, blue, purple, gray.
    Returns cleaned value or None.
    """
    if not color_value:
        return None
    val = str(color_value).strip()
    presets = {'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'}
    if val.lower() in presets:
        return val.lower()
    # hex format
    if val.startswith('#'):
        hexpart = val[1:]
        if len(hexpart) == 6 and all(c in '0123456789abcdefABCDEF' for c in hexpart):
            return '#' + hexpart.lower()
    return None


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


@api.route('/tags/suggest-related', methods=['GET'])
def suggest_related_tags():
    """Suggest related tags based on co-occurrence.
    Query params:
      - tag_ids: comma-separated ints (required)
      - mode: 'any' or 'all' (default 'any')
      - limit: int (default 20)
    """
    raw = request.args.get('tag_ids')
    if not raw:
        return jsonify({'error': 'tag_ids is required'}), 400
    try:
        selected = [int(x.strip()) for x in raw.split(',') if x.strip()]
    except ValueError:
        return jsonify({'error': 'tag_ids must be integers'}), 400
    if not selected:
        return jsonify({'error': 'tag_ids must not be empty'}), 400
    mode = (request.args.get('mode') or 'any').lower()
    limit = request.args.get('limit', 20, type=int)

    # Find candidate files
    from ...models import FileTagMap
    subq = None
    if mode == 'all':
        # files that contain all selected tags
        # group by file_id and ensure count of distinct selected tags equals len(selected)
        subq = (
            db.session.query(FileTagMap.file_id)
            .filter(FileTagMap.tag_id.in_(selected))
            .group_by(FileTagMap.file_id)
            .having(func.count(func.distinct(FileTagMap.tag_id)) == len(selected))
            .subquery()
        )
    else:
        # any of selected
        subq = (
            db.session.query(FileTagMap.file_id)
            .filter(FileTagMap.tag_id.in_(selected))
            .distinct()
            .subquery()
        )

    rows = (
        db.session.query(Tag.id, Tag.name, Tag.type_id, func.count(func.distinct(FileTagMap.file_id)).label('c'))
        .join(FileTagMap, FileTagMap.tag_id == Tag.id)
        .filter(FileTagMap.file_id.in_(db.session.query(subq.c.file_id)))
        .filter(~Tag.id.in_(selected))
        .group_by(Tag.id, Tag.name, Tag.type_id)
        .order_by(func.count(func.distinct(FileTagMap.file_id)).desc(), Tag.name.asc())
        .limit(limit)
        .all()
    )

    # usage counts map for output
    ids = [rid for rid, _, _, _ in rows]
    usage_counts = _usage_counts_for(ids)
    # fetch colors/favorites in one go
    props = {t.id: (t.color, bool(t.is_favorite)) for t in Tag.query.filter(Tag.id.in_(ids)).all()}
    results = [
        {
            'id': rid,
            'name': rname,
            'type_id': rtype,
            'color': props.get(rid, (None, False))[0],
            'is_favorite': props.get(rid, (None, False))[1],
            'co_occurrence': int(rcount),
            'usage_count': int(usage_counts.get(rid, 0) or 0)
        }
        for (rid, rname, rtype, rcount) in rows
    ]
    return jsonify(results)


@api.route('/tags/tree', methods=['GET'])
def get_tag_tree():
    """Return a hierarchical tree of tags grouped by tag type.
    Each node includes usage_count and children_count for quick display.
    """
    # SQLite lacks NULLS LAST; emulate with coalesce
    types = TagType.query.order_by(func.coalesce(TagType.sort_order, 999999).asc(), TagType.name.asc()).all()
    all_tags = Tag.query.order_by(Tag.name.asc()).all()
    tag_ids = [t.id for t in all_tags]
    usage_counts = _usage_counts_for(tag_ids)
    children_counts = _children_counts_for(tag_ids)

    # Build per-type adjacency
    by_type = {}
    for t in all_tags:
        by_type.setdefault(t.type_id, []).append(t)

    def make_node(tag):
        return {
            'id': tag.id,
            'name': tag.name,
            'description': tag.description,
            'type_id': tag.type_id,
            'parent_id': tag.parent_id,
            'color': tag.color,
            'is_favorite': bool(tag.is_favorite),
            'aliases': [a.alias_name for a in tag.aliases],
            'usage_count': int(usage_counts.get(tag.id, 0) or 0),
            'children_count': int(children_counts.get(tag.id, 0) or 0),
            'children': []
        }

    result = []
    for tt in types:
        tags_of_type = by_type.get(tt.id, [])
        # index by id
        nodes = {t.id: make_node(t) for t in tags_of_type}
        roots = []
        for t in tags_of_type:
            node = nodes[t.id]
            if t.parent_id and t.parent_id in nodes:
                nodes[t.parent_id]['children'].append(node)
            else:
                roots.append(node)
        # sort children by name at each level
        stack = roots[:]
        while stack:
            n = stack.pop()
            n['children'].sort(key=lambda x: x['name'].lower())
            stack.extend(n['children'])
        result.append({
            'type': {'id': tt.id, 'name': tt.name, 'sort_order': tt.sort_order},
            'roots': roots
        })

    return jsonify(result)


def tag_to_dict(tag, usage_counts=None, children_counts=None):
    usage_map = usage_counts if usage_counts is not None else _usage_counts_for([tag.id])
    children_map = children_counts if children_counts is not None else _children_counts_for([tag.id])
    return {
        'id': tag.id,
        'name': tag.name,
        'description': tag.description,
        'type_id': tag.type_id,
        'parent_id': tag.parent_id,
        'color': tag.color,
        'is_favorite': bool(tag.is_favorite),
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
    favorite = request.args.get('favorite')
    if q:
        # left join aliases and filter by either
        query = query.outerjoin(TagAlias, TagAlias.tag_id == Tag.id).filter(
            or_(Tag.name.ilike(f"%{q}%"), TagAlias.alias_name.ilike(f"%{q}%"))
        ).distinct()
    fav_flag = None
    if favorite is not None:
        fav_flag = True if str(favorite).strip().lower() in {'1','true','yes','on'} else (
            False if str(favorite).strip().lower() in {'0','false','no','off'} else None
        )
        if fav_flag is not None:
            query = query.filter(Tag.is_favorite.is_(fav_flag))

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
            'color': t.color,
            'is_favorite': bool(t.is_favorite),
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
        description=data.get('description'),
        color=_normalize_color(data.get('color')) if data.get('color') else None,
        is_favorite=bool(data.get('is_favorite')) if data.get('is_favorite') is not None else False,
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
    if 'color' in data:
        tag.color = _normalize_color(data.get('color'))
    if 'is_favorite' in data:
        tag.is_favorite = bool(data.get('is_favorite'))
    
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

@api.route('/tags/<int:id>/favorite', methods=['PUT'])
def set_tag_favorite(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    data = request.get_json() or {}
    if 'is_favorite' not in data:
        return jsonify({'error': 'is_favorite is required'}), 400
    tag.is_favorite = bool(data.get('is_favorite'))
    db.session.commit()
    return jsonify({'id': tag.id, 'is_favorite': bool(tag.is_favorite)})

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
    
    task_name = f'删除标签: {tag.name}' if action == 'delete' else f'重命名标签: {tag.name} -> {new_name}'
    task_type = 'delete' if action == 'delete' else 'rename'

    task_record = Task(
        name=task_name,
        task_type=task_type,
        status='pending',
        progress=0.0,
        processed_files=0,
        total_files=0,
    )
    db.session.add(task_record)
    db.session.commit()

    try:
        task = tag_file_change_task(tag_id, action, new_name, task_db_id=task_record.id)
        task_record.task_id = task.id
        db.session.commit()
        return jsonify({'message': '已提交任务，请在任务管理器中查看进度', 'task_id': task.id, 'db_task_id': task_record.id}), 202
    except Exception as e:
        db.session.rollback()
        failed_record = db.session.get(Task, task_record.id)
        if failed_record:
            import datetime as _dt
            failed_record.status = 'failed'
            failed_record.error_message = f'提交任务失败: {str(e)}'
            failed_record.finished_at = _dt.datetime.utcnow()
            db.session.commit()
        return jsonify({'error': f'提交任务失败: {str(e)}'}), 500 

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
    
    task_record = Task(
        name=f'拆分标签: {tag.name}',
        task_type='split',
        status='pending',
        progress=0.0,
        processed_files=0,
        total_files=0,
    )
    db.session.add(task_record)
    db.session.commit()

    try:
        task = tag_split_task(tag_id, new_tag_names, task_db_id=task_record.id)
        task_record.task_id = task.id
        db.session.commit()
        return jsonify({'message': '已提交任务，请在任务管理器中查看进度', 'task_id': task.id, 'db_task_id': task_record.id}), 202
    except Exception as e:
        db.session.rollback()
        failed_record = db.session.get(Task, task_record.id)
        if failed_record:
            import datetime as _dt
            failed_record.status = 'failed'
            failed_record.error_message = f'提交任务失败: {str(e)}'
            failed_record.finished_at = _dt.datetime.utcnow()
            db.session.commit()
        return jsonify({'error': f'提交任务失败: {str(e)}'}), 500 

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
