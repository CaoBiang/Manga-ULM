# -*- coding: utf-8 -*-
from __future__ import annotations

import datetime
import os
import re
import shutil
from typing import List, Optional, Sequence

from loguru import logger
from sqlalchemy import or_ as sa_or

from .. import create_app, db, huey
from ..models.manga import File, Tag, TagAlias, Task


def sanitize_filename(name: str) -> str:
    """将文件名中的非法字符替换为下划线。"""
    return re.sub(r'[\\/:*?"<>|]', '_', str(name))


def _build_safe_temp_path(original_path: str) -> str:
    """
    构造一个与原文件同目录的临时文件名，用于处理“仅大小写变化”的重命名。

    说明：
    - Windows 常见为大小写不敏感文件系统。
    - 仅大小写变化时，直接 `os.rename(old, new)` 可能被系统判定为“已存在”。
    """
    directory = os.path.dirname(original_path)
    base, ext = os.path.splitext(os.path.basename(original_path))

    suffix = 0
    while True:
        suffix_part = '' if suffix == 0 else f'_{suffix}'
        candidate = os.path.join(directory, f'{base}.__tmp_rename__{suffix_part}{ext}')
        if not os.path.exists(candidate):
            return candidate
        suffix += 1


def _is_within_dir(path: str, root_dir: str) -> bool:
    path_norm = os.path.normcase(os.path.abspath(path))
    root_norm = os.path.normcase(os.path.abspath(root_dir))
    if path_norm == root_norm:
        return True
    return path_norm.startswith(root_norm.rstrip(os.sep) + os.sep)


def _rename_path(old_path: str, new_path: str) -> None:
    if old_path == new_path:
        return

    os.makedirs(os.path.dirname(new_path), exist_ok=True)

    same_path_ignore_case = os.path.normcase(old_path) == os.path.normcase(new_path)
    if not same_path_ignore_case and os.path.exists(new_path):
        raise ValueError('目标文件已存在，无法重命名')

    try:
        if same_path_ignore_case and os.path.exists(new_path):
            temp_path = _build_safe_temp_path(old_path)
            os.rename(old_path, temp_path)
            os.rename(temp_path, new_path)
            return
        os.rename(old_path, new_path)
    except OSError as exc:
        # 跨盘移动或其他导致 os.rename 失败的情况，退化为 shutil.move
        try:
            shutil.move(old_path, new_path)
        except Exception:
            raise exc


def _extract_filename_tags(filename: str) -> List[str]:
    return re.findall(r'\[([^\]]+)\]', filename)


def sync_file_tag_indexes_general(files_to_process: Sequence[File]) -> int:
    """
    通用的文件标签索引同步：确保数据库中的 File.tags 与文件名中的 [tag] 完全一致。

    规则：
    - 文件名中存在 [tag]，数据库中应关联到对应 Tag（支持别名 TagAlias）。
    - 数据库中存在关联，但文件名已不包含 [tag]，则移除该关联。
    """
    sync_count = 0

    for file_obj in files_to_process:
        filename = os.path.basename(file_obj.file_path or '')
        filename_tags = set(_extract_filename_tags(filename))
        current_tag_names = set(tag.name for tag in file_obj.tags)

        tags_to_add = filename_tags - current_tag_names
        tags_to_remove = current_tag_names - filename_tags

        for tag_name in tags_to_add:
            tag_name = str(tag_name).strip()
            if not tag_name:
                continue
            tag = Tag.query.filter(Tag.name.ilike(tag_name)).first()
            if not tag:
                alias = TagAlias.query.filter(TagAlias.alias_name.ilike(tag_name)).first()
                tag = alias.tag if alias else None
            if tag and tag not in file_obj.tags:
                file_obj.tags.append(tag)
                sync_count += 1

        if tags_to_remove:
            to_remove = [tag for tag in file_obj.tags if tag.name in tags_to_remove]
            for tag in to_remove:
                file_obj.tags.remove(tag)
                sync_count += 1

    return sync_count


def generate_new_path(template: str, file_obj: File, root_path: str) -> str:
    """
    基于模板与文件元数据生成新路径（不含扩展名的模板 + 原扩展名）。

    支持占位符：
    - {id} / {title} / {series} / {author} / {volume_number} / {year}
    - {custom_tag:<tag_type_name>}：例如 {custom_tag:character}
    """
    if not template:
        raise ValueError('template 不能为空')
    if not root_path:
        raise ValueError('root_path 不能为空')

    old_path = file_obj.file_path or ''
    title = os.path.splitext(os.path.basename(old_path))[0]

    data = {
        'id': file_obj.id,
        'title': title,
        'series': '',
        'author': '',
        'volume_number': '',
        'year': '',
    }

    for tag in file_obj.tags:
        type_name = ''
        if getattr(tag, 'type', None) and getattr(tag.type, 'name', None):
            type_name = str(tag.type.name).strip().lower()
        if not type_name:
            continue

        if type_name in {'author', 'series', 'title', 'volume_number', 'year'}:
            data[type_name] = tag.name
        else:
            data[f'custom_tag:{type_name}'] = tag.name

    result_path = str(template)
    for key, value in data.items():
        result_path = result_path.replace(f'{{{key}}}', sanitize_filename(str(value)))

    # 清理未使用的占位符
    result_path = re.sub(r'\{[^{}]+\}', '', result_path)

    # 统一分隔符并规整
    result_path = result_path.replace('/', os.sep).replace('\\', os.sep)
    result_path = os.path.normpath(result_path).strip()

    # 禁止绝对路径与上跳
    if os.path.isabs(result_path):
        raise ValueError('template 不能生成绝对路径')
    if result_path.startswith('..' + os.sep) or result_path == '..':
        raise ValueError('template 不能跳出 root_path')

    if result_path in {'', '.'}:
        result_path = sanitize_filename(title) or str(file_obj.id)

    _, ext = os.path.splitext(old_path)
    new_path = os.path.join(root_path, result_path + ext)

    if not _is_within_dir(new_path, root_path):
        raise ValueError('生成路径越界：请检查 template 与 root_path')

    return os.path.normpath(new_path)


def rename_single_file_inplace(file_obj: File, new_filename: str) -> str:
    """
    同步重命名单个文件（磁盘 + 数据库字段），并同步文件名标签索引。

    说明：
    - 仅负责修改 `file_obj.file_path` 与其关联标签，不提交事务。
    - 调用方负责 `db.session.commit()` / `db.session.rollback()`。
    """
    if not file_obj or not getattr(file_obj, 'file_path', None):
        raise ValueError('文件不存在或路径无效')

    requested_name = os.path.basename(str(new_filename or '')).strip()
    if not requested_name:
        raise ValueError('新文件名不能为空')

    old_path = str(file_obj.file_path)
    directory = os.path.dirname(old_path)
    _, old_ext = os.path.splitext(old_path)

    requested_root, requested_ext = os.path.splitext(requested_name)
    if requested_ext == '.':
        raise ValueError('文件扩展名无效')

    ext_to_use = requested_ext if requested_ext else old_ext
    base_to_use = requested_root if requested_ext else requested_name

    sanitized_root = sanitize_filename(base_to_use)
    sanitized_ext = sanitize_filename(ext_to_use.lstrip('.'))
    ext_to_use = f'.{sanitized_ext}' if sanitized_ext else ''

    new_path = os.path.normpath(os.path.join(directory, sanitized_root + ext_to_use))
    if new_path == old_path:
        return old_path

    _rename_path(old_path, new_path)
    file_obj.file_path = new_path
    sync_file_tag_indexes_general([file_obj])
    return new_path


def _is_cancelled(task_db_id: Optional[int]) -> bool:
    if not task_db_id:
        return False
    status = db.session.query(Task.status).filter(Task.id == int(task_db_id)).scalar()
    return status == 'cancelled'


def _set_task_running(task_record: Optional[Task], *, current_file: str, total: int, target_path: Optional[str] = None) -> None:
    if not task_record:
        return
    task_record.status = 'running'
    task_record.started_at = datetime.datetime.utcnow()
    task_record.progress = 0.0
    task_record.total_files = int(total)
    task_record.processed_files = 0
    task_record.current_file = current_file
    task_record.error_message = None
    if target_path is not None:
        task_record.target_path = target_path
    db.session.commit()


def _update_task_progress(task_record: Optional[Task], *, processed: int, total: int, current_file: str, error_message: Optional[str] = None) -> None:
    if not task_record:
        return
    total = max(0, int(total))
    processed = max(0, int(processed))
    progress = (processed / total) * 100 if total else 100.0
    task_record.progress = float(progress)
    task_record.processed_files = processed
    task_record.current_file = current_file
    if error_message:
        task_record.error_message = error_message
    db.session.commit()


def _finish_task(task_record: Optional[Task], *, status: str, message: Optional[str] = None) -> None:
    if not task_record:
        return
    task_record.status = status
    task_record.progress = 100.0
    task_record.current_file = ''
    if message:
        task_record.error_message = message
    task_record.finished_at = datetime.datetime.utcnow()
    db.session.commit()


@huey.task()
def batch_rename_task(file_ids: List[int], template: str, root_path: str, task_db_id: Optional[int] = None) -> str:
    """
    批量重命名：基于模板生成新路径，并移动/重命名文件。
    """
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        task_record = db.session.get(Task, int(task_db_id)) if task_db_id else None
        total = len(file_ids or [])
        _set_task_running(task_record, current_file='准备批量重命名...', total=total, target_path=root_path)

        processed = 0
        failed = 0

        for raw_file_id in file_ids or []:
            if _is_cancelled(task_db_id):
                if task_record:
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()
                return '任务已取消'

            processed += 1
            file_id = int(raw_file_id)
            file_obj = db.session.get(File, file_id)
            if not file_obj:
                _update_task_progress(task_record, processed=processed, total=total, current_file=f'跳过不存在的文件 ID: {file_id}')
                continue

            old_path = str(file_obj.file_path or '')
            current_name = os.path.basename(old_path)
            _update_task_progress(task_record, processed=processed, total=total, current_file=f'处理: {current_name}')

            try:
                new_path = generate_new_path(template, file_obj, root_path)
                _rename_path(old_path, new_path)
                file_obj.file_path = new_path
                sync_file_tag_indexes_general([file_obj])
                db.session.commit()
            except Exception as exc:
                failed += 1
                db.session.rollback()
                msg = f'重命名失败: {current_name} | 错误: {exc}'
                logger.warning(msg)
                _update_task_progress(task_record, processed=processed, total=total, current_file=f'失败: {current_name}', error_message=msg)

        status = 'completed' if failed == 0 else 'failed'
        summary = None
        if failed:
            summary = f'批量重命名存在失败：共失败 {failed} 个文件'
        _finish_task(task_record, status=status, message=summary)
        return '批量重命名完成'


@huey.task()
def tag_file_change_task(tag_id: int, action: str, new_name: Optional[str] = None, task_db_id: Optional[int] = None) -> str:
    """
    标签全局变更（包含文件名与数据库）：
    - action=rename：将标签重命名为 new_name（如 new_name 已存在则合并）。
    - action=delete：从所有文件名中删除该标签，并删除该标签本身。
    """
    if action not in {'delete', 'rename'}:
        raise ValueError('action 必须为 delete 或 rename')
    if action == 'rename' and (not new_name or not str(new_name).strip()):
        raise ValueError('rename 操作必须提供 new_name')

    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        task_record = db.session.get(Task, int(task_db_id)) if task_db_id else None

        tag = db.session.get(Tag, int(tag_id))
        if not tag:
            _finish_task(task_record, status='failed', message='标签不存在')
            return '标签不存在'

        patterns = [tag.name] + [a.alias_name for a in tag.aliases]
        filters = [File.file_path.ilike(f'%[{p}]%') for p in patterns]
        files = File.query.filter(sa_or(*filters)).all() if filters else []
        total = len(files)

        title = f'删除标签: {tag.name}' if action == 'delete' else f'重命名标签: {tag.name} -> {new_name}'
        if task_record:
            task_record.name = task_record.name or title
        _set_task_running(task_record, current_file='准备处理文件...', total=total)

        processed = 0
        failed = 0

        def build_new_basename(old_basename: str) -> str:
            result = old_basename
            for p in patterns:
                result = result.replace(f'[{p}]', '' if action == 'delete' else f'[{str(new_name).strip()}]')
            result = re.sub(r'\s+', ' ', result).strip()
            return result

        for file_obj in files:
            if _is_cancelled(task_db_id):
                if task_record:
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()
                return '任务已取消'

            processed += 1
            old_path = str(file_obj.file_path or '')
            dirname = os.path.dirname(old_path)
            old_basename = os.path.basename(old_path)
            new_basename = build_new_basename(old_basename)
            new_path = os.path.normpath(os.path.join(dirname, new_basename))

            _update_task_progress(task_record, processed=processed, total=total, current_file=f'处理: {old_basename}')

            if new_path == old_path:
                continue

            try:
                _rename_path(old_path, new_path)
                file_obj.file_path = new_path
                db.session.commit()
            except Exception as exc:
                failed += 1
                db.session.rollback()
                msg = f'处理失败: {old_basename} | 错误: {exc}'
                logger.warning(msg)
                _update_task_progress(task_record, processed=processed, total=total, current_file=f'失败: {old_basename}', error_message=msg)

        # 处理数据库层面的标签变更
        if action == 'rename':
            new_name_clean = str(new_name).strip()
            try:
                existing = Tag.query.filter(Tag.name.ilike(new_name_clean)).first()
                if existing and int(existing.id) != int(tag.id):
                    # 合并：将旧标签的文件关联/别名折叠到新标签
                    existing_aliases = {str(a.alias_name).lower() for a in existing.aliases}
                    to_add = {tag.name}
                    to_add.update({a.alias_name for a in tag.aliases})
                    for alias_name in to_add:
                        if str(alias_name).lower() in existing_aliases:
                            continue
                        if Tag.query.filter(Tag.name.ilike(alias_name)).first():
                            continue
                        if TagAlias.query.filter(TagAlias.alias_name.ilike(alias_name)).first():
                            continue
                        db.session.add(TagAlias(tag_id=existing.id, alias_name=alias_name))

                    # 迁移文件关联
                    for f in list(tag.files):
                        if existing not in f.tags:
                            f.tags.append(existing)
                        if tag in f.tags:
                            f.tags.remove(tag)

                    # 删除旧标签（会级联清理 aliases 等关联）
                    db.session.delete(tag)
                    db.session.commit()
                else:
                    # 直接重命名，并保留旧名作为别名，避免部分文件改名失败后丢失映射
                    old_name = tag.name
                    tag.name = new_name_clean
                    if not TagAlias.query.filter(TagAlias.alias_name.ilike(old_name)).first():
                        if not Tag.query.filter(Tag.name.ilike(old_name)).first():
                            db.session.add(TagAlias(tag_id=tag.id, alias_name=old_name))
                    db.session.commit()
            except Exception as exc:
                db.session.rollback()
                failed += 1
                msg = f'标签重命名失败: {exc}'
                logger.warning(msg)
                _update_task_progress(task_record, processed=processed, total=total, current_file='标签重命名失败', error_message=msg)

        if action == 'delete' and failed == 0:
            try:
                db.session.delete(tag)
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                failed += 1
                msg = f'删除标签失败: {exc}'
                logger.warning(msg)
                _update_task_progress(task_record, processed=processed, total=total, current_file='删除标签失败', error_message=msg)

        # 同步文件标签索引（确保文件名与关联一致）
        try:
            sync_file_tag_indexes_general(files)
            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            failed += 1
            msg = f'同步文件标签索引失败: {exc}'
            logger.warning(msg)
            _update_task_progress(task_record, processed=processed, total=total, current_file='同步标签索引失败', error_message=msg)

        if failed:
            _finish_task(task_record, status='failed', message=f'处理存在失败：共失败 {failed} 项')
            return '处理失败'
        _finish_task(task_record, status='completed')
        return '处理完成'


@huey.task()
def tag_split_task(tag_id: int, new_tag_names: List[str], task_db_id: Optional[int] = None) -> str:
    """
    拆分标签（包含文件名与数据库）：
    - 将原标签从所有文件名中移除
    - 追加新标签列表到文件名末尾（扩展名前）
    - 为每个文件移除原标签关联并添加新标签关联
    - 如全部成功，则删除原标签
    """
    if not isinstance(new_tag_names, list) or not new_tag_names:
        raise ValueError('new_tag_names 必须为非空列表')

    new_tag_names_clean = [str(n).strip() for n in new_tag_names if str(n).strip()]
    if not new_tag_names_clean:
        raise ValueError('new_tag_names 不能为空')

    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        task_record = db.session.get(Task, int(task_db_id)) if task_db_id else None

        original = db.session.get(Tag, int(tag_id))
        if not original:
            _finish_task(task_record, status='failed', message='原标签不存在')
            return '原标签不存在'

        patterns = [original.name] + [a.alias_name for a in original.aliases]
        filters = [File.file_path.ilike(f'%[{p}]%') for p in patterns]
        files = File.query.filter(sa_or(*filters)).all() if filters else []
        total = len(files)

        title = f'拆分标签: {original.name} -> {", ".join(new_tag_names_clean)}'
        if task_record:
            task_record.name = task_record.name or title
        _set_task_running(task_record, current_file='准备拆分标签...', total=total)

        # 创建/校验新标签（同类型）
        new_tags: List[Tag] = []
        for name in new_tag_names_clean:
            existing = Tag.query.filter(Tag.name.ilike(name)).first()
            if existing:
                if existing.type_id != original.type_id:
                    _finish_task(task_record, status='failed', message=f'标签 [{name}] 已存在但类型不一致')
                    return '标签类型不一致'
                new_tags.append(existing)
                continue
            new_tag = Tag(name=name, type_id=original.type_id, description=f'由 [{original.name}] 拆分而来')
            db.session.add(new_tag)
            db.session.flush()
            new_tags.append(new_tag)

        db.session.commit()

        processed = 0
        failed = 0

        suffix = ''.join([f'[{t.name}]' for t in new_tags])

        def build_new_basename(old_basename: str) -> str:
            base, ext = os.path.splitext(old_basename)
            for p in patterns:
                base = base.replace(f'[{p}]', '')
            base = re.sub(r'\s+', ' ', base).strip()
            return base + suffix + ext

        for file_obj in files:
            if _is_cancelled(task_db_id):
                if task_record:
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()
                return '任务已取消'

            processed += 1
            old_path = str(file_obj.file_path or '')
            dirname = os.path.dirname(old_path)
            old_basename = os.path.basename(old_path)
            new_basename = build_new_basename(old_basename)
            new_path = os.path.normpath(os.path.join(dirname, new_basename))

            _update_task_progress(task_record, processed=processed, total=total, current_file=f'处理: {old_basename}')

            try:
                if new_path != old_path:
                    _rename_path(old_path, new_path)
                    file_obj.file_path = new_path

                if original in file_obj.tags:
                    file_obj.tags.remove(original)
                for t in new_tags:
                    if t not in file_obj.tags:
                        file_obj.tags.append(t)

                sync_file_tag_indexes_general([file_obj])
                db.session.commit()
            except Exception as exc:
                failed += 1
                db.session.rollback()
                msg = f'处理失败: {old_basename} | 错误: {exc}'
                logger.warning(msg)
                _update_task_progress(task_record, processed=processed, total=total, current_file=f'失败: {old_basename}', error_message=msg)

        if failed == 0:
            try:
                db.session.delete(original)
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                failed += 1
                msg = f'删除原标签失败: {exc}'
                logger.warning(msg)
                _update_task_progress(task_record, processed=processed, total=total, current_file='删除原标签失败', error_message=msg)

        if failed:
            _finish_task(task_record, status='failed', message=f'拆分存在失败：共失败 {failed} 个文件')
            return '拆分失败'
        _finish_task(task_record, status='completed')
        return '拆分完成'
