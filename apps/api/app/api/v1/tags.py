import re
from flask import request, jsonify
from . import api
from ... import db
from ...models import Tag, TagType, TagAlias, File, FileTagMap
from ...tasks.rename import tag_file_change_task, tag_split_task
from ...services.task_service import create_task_record, fail_task, finish_task, mark_task_running, update_task_progress
from sqlalchemy import func, or_


def _normalize_color(color_value):
    """归一化颜色输入，返回安全值或 None。

    支持：
    - 16 进制：#RRGGBB
    - 预设色：red/orange/yellow/green/blue/purple/gray
    """
    if not color_value:
        return None
    val = str(color_value).strip()
    presets = {'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'}
    if val.lower() in presets:
        return val.lower()
    # 16 进制格式
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


@api.route('/tag-suggestions/related', methods=['GET'])
def suggest_related_tags():
    """基于共现关系推荐相关标签。

    查询参数：
    - tag_ids：逗号分隔的整数（必填）
    - mode：any/all（默认 any）
    - limit：默认 20
    """
    raw = request.args.get('tag_ids')
    if not raw:
        return jsonify({'error': '必须提供 tag_ids'}), 400
    try:
        selected = [int(x.strip()) for x in raw.split(',') if x.strip()]
    except ValueError:
        return jsonify({'error': 'tag_ids 必须为整数'}), 400
    if not selected:
        return jsonify({'error': 'tag_ids 不能为空'}), 400
    mode = (request.args.get('mode') or 'any').lower()
    limit = request.args.get('limit', 20, type=int)

    # 查找候选文件集合
    from ...models import FileTagMap
    subq = None
    if mode == 'all':
        # 包含全部已选标签的文件：按 file_id 分组，确保 distinct(tag_id) 数量等于 len(selected)
        subq = (
            db.session.query(FileTagMap.file_id)
            .filter(FileTagMap.tag_id.in_(selected))
            .group_by(FileTagMap.file_id)
            .having(func.count(func.distinct(FileTagMap.tag_id)) == len(selected))
            .subquery()
        )
    else:
        # 包含任一已选标签的文件
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

    # 计算 usage_count
    ids = [rid for rid, _, _, _ in rows]
    usage_counts = _usage_counts_for(ids)
    # 一次性读取颜色/收藏属性
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


@api.route('/tag-tree', methods=['GET'])
def get_tag_tree():
    """返回按“标签类型”分组的树形标签结构（含使用次数与子节点数量）。"""
    # SQLite 不支持 NULLS LAST，用 coalesce 规避
    types = TagType.query.order_by(func.coalesce(TagType.sort_order, 999999).asc(), TagType.name.asc()).all()
    all_tags = Tag.query.order_by(Tag.name.asc()).all()
    tag_ids = [t.id for t in all_tags]
    usage_counts = _usage_counts_for(tag_ids)
    children_counts = _children_counts_for(tag_ids)

    # 构建按类型分组的邻接表
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
        # 按 id 建索引
        nodes = {t.id: make_node(t) for t in tags_of_type}
        roots = []
        for t in tags_of_type:
            node = nodes[t.id]
            if t.parent_id and t.parent_id in nodes:
                nodes[t.parent_id]['children'].append(node)
            else:
                roots.append(node)
        # 每层按 name 排序
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

# 标签：查询（支持筛选/搜索/分页）
@api.route('/tags', methods=['GET'])
def get_tags():
    """标签列表（支持筛选/搜索/分页）。

    查询参数：
    - type_id: int
    - parent_id: int
    - q: 关键词（匹配标签名或别名）
    - favorite: 1/0/true/false
    - page: int（默认 1）
    - per_page: int（默认 20；传 0 表示不分页）
    - sort: name（默认）
    - order: asc/desc（默认 asc）
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
        # 左连接别名表，按“标签名/别名”任意匹配
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
        # 默认兜底
        query = query.order_by(Tag.name.asc())

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    if per_page <= 0:
        tag_list = query.all()
        tag_ids = [t.id for t in tag_list]
        usage_counts = _usage_counts_for(tag_ids)
        children_counts = _children_counts_for(tag_ids)
        return jsonify({
            'tags': [tag_to_dict(t, usage_counts, children_counts) for t in tag_list],
            'total': len(tag_list),
            'page': 1,
            'pages': 1,
        })

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    tag_list = pagination.items
    tag_ids = [t.id for t in tag_list]
    usage_counts = _usage_counts_for(tag_ids)
    children_counts = _children_counts_for(tag_ids)

    return jsonify({
        'tags': [tag_to_dict(t, usage_counts, children_counts) for t in tag_list],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })

@api.route('/tag-suggestions', methods=['GET'])
def suggest_tags():
    """轻量标签建议（用于下拉框/远程搜索）。

    查询参数：q, type_id, limit（默认 20）
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
    """创建标签。"""
    data = request.get_json(silent=True) or {}
    raw_name = data.get('name')
    raw_type_id = data.get('type_id')
    if not raw_name or raw_type_id is None:
        return jsonify({'error': '必须提供 name 与 type_id'}), 400
    
    name = str(raw_name).strip()
    if not name:
        return jsonify({'error': 'name 不能为空'}), 400
    try:
        type_id = int(raw_type_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'type_id 必须为整数'}), 400

    # 唯一性校验（不区分大小写）
    exists = Tag.query.filter(Tag.name.ilike(name)).first()
    if exists:
        return jsonify({'error': '标签名已存在'}), 409
    
    tag = Tag(
        name=name,
        type_id=type_id,
        parent_id=data.get('parent_id'),
        description=data.get('description'),
        color=_normalize_color(data.get('color')) if data.get('color') else None,
        is_favorite=bool(data.get('is_favorite')) if data.get('is_favorite') is not None else False,
    )
    db.session.add(tag)
    db.session.flush()  # 获取tag的ID
    
    # 添加别名
    if 'aliases' in data and isinstance(data['aliases'], list):
        for alias_name in data['aliases']:
            if not alias_name:
                continue
            alias_clean = alias_name.strip()
            if not alias_clean:
                continue
            # 防止别名与现有标签名/别名冲突
            if Tag.query.filter(Tag.name.ilike(alias_clean)).first():
                continue
            if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_clean)).first():
                continue
            alias = TagAlias(tag_id=tag.id, alias_name=alias_clean)
            db.session.add(alias)
    
    db.session.commit()
    result = tag_to_dict(tag)
    return jsonify(result), 201

# 单个标签：查询/更新/删除
@api.route('/tags/<int:id>', methods=['GET'])
def get_tag(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404
    return jsonify(tag_to_dict(tag))

@api.route('/tags/<int:id>', methods=['PUT'])
def update_tag(id):
    """更新标签。"""
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': '请求体不能为空'}), 400
    
    # 更新标签属性（name 需要唯一性校验）
    new_name = data.get('name', tag.name)
    if new_name and new_name.strip() and new_name.strip() != tag.name:
        conflict = Tag.query.filter(Tag.name.ilike(new_name.strip()), Tag.id != id).first()
        if conflict:
            return jsonify({'error': '标签名已存在'}), 409
        tag.name = new_name.strip()

    if 'type_id' in data:
        try:
            tag.type_id = int(data.get('type_id'))
        except (TypeError, ValueError):
            return jsonify({'error': 'type_id 必须为整数'}), 400
    tag.parent_id = data.get('parent_id', tag.parent_id)
    tag.description = data.get('description', tag.description)
    if 'color' in data:
        tag.color = _normalize_color(data.get('color'))
    if 'is_favorite' in data:
        tag.is_favorite = bool(data.get('is_favorite'))
    
    # 原子更新 aliases
    if 'aliases' in data and isinstance(data['aliases'], list):
        new_aliases = set(a.strip() for a in data['aliases'] if a and a.strip())
        old_aliases = {a.alias_name for a in tag.aliases}

        to_add = new_aliases - old_aliases
        to_remove = old_aliases - new_aliases

        if to_remove:
            TagAlias.query.filter(TagAlias.tag_id == id, TagAlias.alias_name.in_(to_remove)).delete(synchronize_session=False)

        for alias_name in to_add:
            # 防止别名与现有标签名/别名冲突
            if Tag.query.filter(Tag.name.ilike(alias_name)).first():
                continue
            if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_name)).first():
                continue
            db.session.add(TagAlias(tag_id=id, alias_name=alias_name))
    
    db.session.commit()
    result = tag_to_dict(tag)
    return jsonify(result)

@api.route('/tags/<int:id>', methods=['DELETE'])
def delete_tag(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404

    # 解除关联，避免外键问题
    FileTagMap.query.filter_by(tag_id=id).delete(synchronize_session=False)
    TagAlias.query.filter_by(tag_id=id).delete(synchronize_session=False)
    db.session.delete(tag)
    db.session.commit()
    return '', 204

@api.route('/reports/undefined-tags', methods=['GET'])
def scan_undefined_tags():
    """扫描文件名中的 [tag]，返回数据库中尚未定义的标签列表。"""
    try:
        # 收集已存在的 tag 名称与别名
        all_tags = Tag.query.with_entities(Tag.name).all()
        all_aliases = TagAlias.query.with_entities(TagAlias.alias_name).all()
        existing_tags = set([item[0] for item in all_tags]) | set([item[0] for item in all_aliases])

        # 从文件路径中提取形如 [tag] 的片段
        potential_tags = set()
        for (path,) in db.session.query(File.file_path).yield_per(1000):
            if not path:
                continue
            found = re.findall(r'\[([^\]]+)\]', path)
            for tag_name in found:
                potential_tags.add(tag_name.strip())

        # 过滤出“未定义标签”
        undefined_tags = sorted(list(potential_tags - existing_tags))
        return jsonify(undefined_tags)
    except Exception as e:
        return jsonify({'error': f'扫描未定义标签失败: {str(e)}'}), 500

# 标签别名
@api.route('/tags/<int:id>/aliases', methods=['POST'])
def add_tag_alias(id):
    tag = db.session.get(Tag, id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404
    data = request.get_json(silent=True) or {}
    if not data.get('alias_name'):
        return jsonify({'error': '必须提供 alias_name'}), 400
    
    alias_name = str(data['alias_name']).strip()
    if not alias_name:
        return jsonify({'error': 'alias_name 不能为空'}), 400

    # 冲突检查：别名不得与现有标签名/别名重复
    if Tag.query.filter(Tag.name.ilike(alias_name)).first():
        return jsonify({'error': '别名与现有标签名冲突'}), 409
    if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_name)).first():
        return jsonify({'error': '别名已存在'}), 409
    alias = TagAlias(tag_id=id, alias_name=alias_name)
    db.session.add(alias)
    db.session.commit()
    return jsonify({'id': alias.id, 'alias_name': alias.alias_name}), 201

@api.route('/tag-aliases/<int:alias_id>', methods=['DELETE'])
def delete_tag_alias(alias_id):
    alias = db.session.get(TagAlias, alias_id)
    if not alias:
        return jsonify({'error': '别名不存在'}), 404
    db.session.delete(alias)
    db.session.commit()
    return '', 204

# 文件-标签关联（幂等）
@api.route('/files/<int:file_id>/tags/<int:tag_id>', methods=['PUT'])
def add_tag_to_file(file_id, tag_id):
    file = db.session.get(File, file_id)
    tag = db.session.get(Tag, tag_id)
    if not file or not tag:
        return jsonify({'error': '文件或标签不存在'}), 404

    if any(t.id == tag_id for t in file.tags):
        return '', 204
    
    file.tags.append(tag)
    db.session.commit()
    return '', 204

@api.route('/files/<int:file_id>/tags/<int:tag_id>', methods=['DELETE'])
def remove_tag_from_file(file_id, tag_id):
    file = db.session.get(File, file_id)
    if not file:
        return jsonify({'error': '文件不存在'}), 404
        
    tag = next((t for t in file.tags if t.id == tag_id), None)
    if tag:
        file.tags.remove(tag)
        db.session.commit()
        
    return '', 204

@api.route('/tag-file-changes', methods=['POST'])
def create_tag_file_change():
    """
    批量修改文件名中的指定标签（删除/重命名）。

    请求体：
    - tag_id: int（必填）
    - action: delete/rename（必填）
    - new_name: string（action=rename 时必填）
    """
    data = request.get_json(silent=True) or {}
    raw_tag_id = data.get('tag_id')
    if raw_tag_id is None or isinstance(raw_tag_id, bool):
        return jsonify({'error': '必须提供 tag_id（整数）'}), 400
    try:
        tag_id = int(raw_tag_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'tag_id 必须为整数'}), 400

    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404

    action = str(data.get('action') or '').strip().lower()
    if action not in {'delete', 'rename'}:
        return jsonify({'error': 'action 必须为 delete 或 rename'}), 400

    new_name = None
    if action == 'rename':
        new_name = str(data.get('new_name') or '').strip()
        if not new_name:
            return jsonify({'error': 'action=rename 时必须提供 new_name'}), 400

    task_name = f'删除标签: {tag.name}' if action == 'delete' else f'重命名标签: {tag.name} -> {new_name}'
    task_type = 'tag_file_delete' if action == 'delete' else 'tag_file_rename'

    task_record = create_task_record(
        name=task_name,
        task_type=task_type,
        status='pending',
        total_files=0,
        processed_files=0,
        progress=0.0,
        current_file='准备中...',
    )

    try:
        task = tag_file_change_task(tag_id, action, new_name, task_db_id=task_record.id)
        task_record.task_id = task.id
        db.session.commit()
        return jsonify({'message': '已提交任务，请在任务管理器中查看进度', 'task_id': task.id, 'db_task_id': task_record.id}), 202
    except Exception as exc:
        db.session.rollback()
        fail_task(task_record, error_message=f'提交任务失败: {str(exc)}')
        return jsonify({'error': f'提交任务失败: {str(exc)}'}), 500

@api.route('/tag-splits', methods=['POST'])
def split_tag():
    """
    拆分标签：将一个标签拆分成多个同类型标签
    """
    data = request.get_json(silent=True) or {}
    raw_tag_id = data.get('tag_id')
    if raw_tag_id is None or isinstance(raw_tag_id, bool):
        return jsonify({'error': '必须提供 tag_id（整数）'}), 400
    try:
        tag_id = int(raw_tag_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'tag_id 必须为整数'}), 400

    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404

    if not data.get('new_tag_names'):
        return jsonify({'error': '必须提供 new_tag_names'}), 400
    
    new_tag_names = data['new_tag_names']
    
    # 验证新标签名称列表
    if not isinstance(new_tag_names, list) or len(new_tag_names) == 0:
        return jsonify({'error': 'new_tag_names 必须为非空数组'}), 400
    
    # 验证新标签名称不为空
    for tag_name in new_tag_names:
        if not tag_name or not tag_name.strip():
            return jsonify({'error': 'new_tag_names 中存在空值'}), 400
    
    # 去重和清理
    new_tag_names = list(set(name.strip() for name in new_tag_names))
    
    task_record = create_task_record(
        name=f'拆分标签: {tag.name}',
        task_type='tag_split',
        status='pending',
        total_files=0,
        processed_files=0,
        progress=0.0,
        current_file='准备中...',
    )

    try:
        task = tag_split_task(tag_id, new_tag_names, task_db_id=task_record.id)
        task_record.task_id = task.id
        db.session.commit()
        return jsonify({'message': '已提交任务，请在任务管理器中查看进度', 'task_id': task.id, 'db_task_id': task_record.id}), 202
    except Exception as exc:
        db.session.rollback()
        fail_task(task_record, error_message=f'提交任务失败: {str(exc)}')
        return jsonify({'error': f'提交任务失败: {str(exc)}'}), 500

@api.route('/tag-file-changes/preview', methods=['POST'])
def preview_change_tag_in_files():
    """预览“删除/重命名标签”对文件名的影响。"""
    data = request.get_json(silent=True) or {}
    raw_tag_id = data.get('tag_id')
    if raw_tag_id is None or isinstance(raw_tag_id, bool):
        return jsonify({'error': '必须提供 tag_id（整数）'}), 400
    try:
        tag_id = int(raw_tag_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'tag_id 必须为整数'}), 400

    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404

    action = str(data.get('action') or '').strip().lower()
    if action not in {'delete', 'rename'}:
        return jsonify({'error': 'action 必须为 delete 或 rename'}), 400
    new_name = data.get('new_name') if action == 'rename' else None
    if action == 'rename' and (not new_name or not new_name.strip()):
        return jsonify({'error': 'action=rename 时必须提供 new_name'}), 400

    # 收集匹配模式（标签名 + 别名）
    patterns = [tag.name] + [a.alias_name for a in tag.aliases]
    # 查询包含任意 [pattern] 的文件
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


@api.route('/tag-splits/preview', methods=['POST'])
def preview_split_tag():
    """预览“拆分标签”对文件名的影响。"""
    data = request.get_json(silent=True) or {}
    raw_tag_id = data.get('tag_id')
    if raw_tag_id is None or isinstance(raw_tag_id, bool):
        return jsonify({'error': '必须提供 tag_id（整数）'}), 400
    try:
        tag_id = int(raw_tag_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'tag_id 必须为整数'}), 400

    tag = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({'error': '标签不存在'}), 404

    new_tag_names = data.get('new_tag_names') or []
    if not isinstance(new_tag_names, list) or not new_tag_names:
        return jsonify({'error': 'new_tag_names 必须为非空数组'}), 400

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
        # 预览时：将新标签追加到文件名末尾（扩展名前）
        import os as _os
        base, ext = _os.path.splitext(new_path)
        suffix = ''.join([f'[{n}]' for n in new_tag_names])
        new_path = base + suffix + ext
        examples.append({'old': old_path, 'new': new_path})

    return jsonify({'impacted': impacted, 'examples': examples})


@api.route('/tag-merges', methods=['POST'])
def merge_tags():
    """合并标签：将 source 标签合并到 target 标签。"""
    data = request.get_json(silent=True) or {}
    raw_source_id = data.get('source_tag_id')
    raw_target_id = data.get('target_tag_id')
    if raw_source_id is None or raw_target_id is None:
        return jsonify({'error': '必须提供 source_tag_id 与 target_tag_id'}), 400
    if isinstance(raw_source_id, bool) or isinstance(raw_target_id, bool):
        return jsonify({'error': 'source_tag_id 与 target_tag_id 必须为整数'}), 400
    try:
        source_id = int(raw_source_id)
        target_id = int(raw_target_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'source_tag_id 与 target_tag_id 必须为整数'}), 400
    if source_id == target_id:
        return jsonify({'error': '不能将标签合并到自身'}), 400

    src = db.session.get(Tag, source_id)
    if not src:
        return jsonify({'error': '源标签不存在'}), 404
    tgt = db.session.get(Tag, target_id)
    if not tgt:
        return jsonify({'error': '目标标签不存在'}), 404
    if tgt.type_id != src.type_id:
        return jsonify({'error': '合并失败：标签类型不一致'}), 400

    mapping_count = int(db.session.query(func.count(FileTagMap.file_id)).filter(FileTagMap.tag_id == src.id).scalar() or 0)
    task_record = create_task_record(
        name=f'合并标签: {src.name} -> {tgt.name}',
        task_type='tag_merge',
        status='pending',
        total_files=mapping_count,
        processed_files=0,
        progress=0.0,
        current_file='准备中...',
    )

    try:
        mark_task_running(task_record, current_file='迁移文件关联...', total_files=mapping_count, processed_files=0)

        # 1) 迁移文件关联（避免 N+1 查询）
        rows = db.session.query(FileTagMap.file_id, FileTagMap.tag_id).filter(FileTagMap.tag_id.in_([src.id, tgt.id])).all()
        src_file_ids = [file_id for file_id, tag_id in rows if tag_id == src.id]
        tgt_file_ids = {file_id for file_id, tag_id in rows if tag_id == tgt.id}

        missing_ids = [file_id for file_id in src_file_ids if file_id not in tgt_file_ids]
        if missing_ids:
            db.session.bulk_save_objects([FileTagMap(file_id=file_id, tag_id=tgt.id) for file_id in missing_ids])

        # 2) 删除旧关联
        FileTagMap.query.filter_by(tag_id=src.id).delete(synchronize_session=False)

        # 合并别名（包含源标签名）
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

        # 最后删除源标签
        TagAlias.query.filter_by(tag_id=src.id).delete(synchronize_session=False)
        db.session.delete(src)
        db.session.commit()

        update_task_progress(task_record, processed_files=mapping_count, total_files=mapping_count, current_file='')
        finish_task(task_record, status='completed')
        return jsonify({'message': '合并成功', 'target': tag_to_dict(tgt), 'db_task_id': task_record.id})
    except Exception as e:
        db.session.rollback()
        fail_task(task_record, error_message=f'合并失败: {str(e)}')
        return jsonify({'error': f'合并失败: {str(e)}', 'db_task_id': task_record.id}), 500
