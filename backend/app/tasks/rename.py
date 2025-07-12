import os
import re
from .. import huey, db, socketio
from ..models import File, Tag
from .. import create_app

def sanitize_filename(name):
    """Replaces illegal characters in a filename with underscores."""
    return re.sub(r'[\\/:*?"<>|]', '_', name)

def generate_new_path(template, file_obj, root_path):
    """
    Generates a new file path based on a template and file metadata.
    """
    data = {
        'id': file_obj.id,
        'title': os.path.splitext(os.path.basename(file_obj.file_path))[0], # Fallback title
        'series': '',
        'author': '',
        'volume_number': '',
        'year': '',
    }
    
    # Populate data from tags
    for tag in file_obj.tags:
        type_name = tag.type.name.lower()
        if type_name in ['author', 'series', 'title', 'volume_number', 'year']:
            data[type_name] = tag.name
        else:
            # For custom tags like {custom_tag:character}
            custom_key = f"custom_tag:{type_name}"
            data[custom_key] = tag.name

    # Replace placeholders
    result_path = template
    for key, value in data.items():
        result_path = result_path.replace(f"{{{key}}}", sanitize_filename(str(value)))
        
    # Clean up any unused placeholders
    result_path = re.sub(r'\{[^}]+\}', '', result_path)
    
    # Remove empty directories/double slashes
    result_path = os.path.normpath(result_path.replace('//', '/').replace('\\\\', '\\'))

    # Get the file extension
    _, ext = os.path.splitext(file_obj.file_path)
    
    return os.path.join(root_path, result_path + ext)


@huey.task()
def batch_rename_task(file_ids, template, root_path):
    """
    Renames a batch of files based on a template.
    """
    total_files = len(file_ids)
    processed_files = 0
    socketio.emit('rename_progress', {'progress': 0, 'current_file': 'Starting rename...'})
    
    with db.app.app_context():
        for file_id in file_ids:
            file_to_rename = db.session.get(File, file_id)
            if not file_to_rename:
                continue

            old_path = file_to_rename.file_path
            new_path = generate_new_path(template, file_to_rename, root_path)
            
            processed_files += 1
            progress = (processed_files / total_files) * 100
            socketio.emit('rename_progress', {'progress': progress, 'current_file': f"Renaming {os.path.basename(old_path)}"})

            try:
                # Ensure destination directory exists
                os.makedirs(os.path.dirname(new_path), exist_ok=True)
                
                # Rename file on filesystem
                os.rename(old_path, new_path)
                
                # Update database record
                file_to_rename.file_path = new_path
                db.session.commit()
                
            except Exception as e:
                socketio.emit('rename_error', {'error': f"Failed to rename {os.path.basename(old_path)}: {e}"})
                # We rollback the single failed transaction, but continue with the next files
                db.session.rollback()

    socketio.emit('rename_complete', {'message': f'Rename complete. Processed {total_files} files.'})
    return f"Rename finished for {total_files} files." 

@huey.task()
def tag_file_change_task(tag_id, action, new_name=None):
    """
    批量修改文件名中的标签：删除或重命名
    """
    print(f"Tag file change task started: tag_id={tag_id}, action={action}, new_name={new_name}")
    
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        # 重新初始化socketio以确保在任务中正常工作
        socketio.init_app(app, async_mode='eventlet', cors_allowed_origins="*")
        tag = db.session.get(Tag, tag_id)
        if not tag:
            socketio.emit('tag_change_error', {'error': 'Tag not found'})
            return "Tag not found"
        
        old_tag_name = tag.name
        
        # 获取所有文件，查找包含该标签的文件
        all_files = File.query.all()
        files_to_update = []
        
        # 创建所有可能的标签名（包括别名）
        tag_patterns = [old_tag_name]
        tag_patterns.extend([alias.alias_name for alias in tag.aliases])
        
        for file_obj in all_files:
            file_path = file_obj.file_path
            # 检查文件名是否包含该标签（在方括号内）
            for tag_pattern in tag_patterns:
                if f'[{tag_pattern}]' in file_path:
                    files_to_update.append(file_obj)
                    break
        
        total_files = len(files_to_update)
        if total_files == 0:
            socketio.emit('tag_change_complete', {'message': f'没有找到包含标签 [{old_tag_name}] 的文件'})
            return "No files found with this tag"
        
        initial_progress_data = {
            'progress': 0, 
            'current_file': f'开始处理 {total_files} 个文件...',
            'total_files': total_files
        }
        socketio.emit('tag_change_progress', initial_progress_data)
        print(f"Emitted initial progress: {initial_progress_data}")
        
        processed_files = 0
        success_count = 0
        error_count = 0
        
        for file_obj in files_to_update:
            old_path = file_obj.file_path
            processed_files += 1
            progress = (processed_files / total_files) * 100
            
            progress_data = {
                'progress': progress,
                'current_file': f'处理文件 {os.path.basename(old_path)}',
                'total_files': total_files,
                'processed': processed_files
            }
            socketio.emit('tag_change_progress', progress_data)
            print(f"Emitted progress: {progress_data}")
            
            try:
                new_path = old_path
                
                # 对所有可能的标签名进行替换
                for tag_pattern in tag_patterns:
                    tag_bracket = f'[{tag_pattern}]'
                    if tag_bracket in new_path:
                        if action == 'delete':
                            # 删除标签
                            new_path = new_path.replace(tag_bracket, '')
                        elif action == 'rename':
                            # 重命名标签
                            new_path = new_path.replace(tag_bracket, f'[{new_name}]')
                
                # 清理多余的空格和路径分隔符
                new_path = re.sub(r'\s+', ' ', new_path).strip()
                new_path = os.path.normpath(new_path)
                
                # 如果路径没有变化，跳过
                if new_path == old_path:
                    continue
                
                # 确保目标目录存在
                os.makedirs(os.path.dirname(new_path), exist_ok=True)
                
                # 重命名文件
                os.rename(old_path, new_path)
                
                # 更新数据库
                file_obj.file_path = new_path
                db.session.commit()
                
                success_count += 1
                
            except Exception as e:
                error_count += 1
                socketio.emit('tag_change_error', {
                    'error': f"处理文件 {os.path.basename(old_path)} 失败: {str(e)}"
                })
                db.session.rollback()
        
        # 处理标签重命名后的同步更新
        if action == 'rename' and new_name:
            try:
                existing_tag = Tag.query.filter_by(name=new_name).first()
                
                if existing_tag and existing_tag.id != tag_id:
                    # 目标标签已存在，需要合并到现有标签
                    print(f"Target tag [{new_name}] already exists, merging...")
                    
                    # 1. 将当前标签的所有文件关联转移到目标标签
                    files_with_current_tag = list(tag.files)  # 创建副本避免迭代中修改
                    for file_obj in files_with_current_tag:
                        if existing_tag not in file_obj.tags:
                            file_obj.tags.append(existing_tag)
                            print(f"Added existing tag [{new_name}] to file: {file_obj.file_path}")
                        if tag in file_obj.tags:
                            file_obj.tags.remove(tag)
                            print(f"Removed old tag [{old_tag_name}] from file: {file_obj.file_path}")
                    
                    # 2. 确保所有已重命名的文件都关联到目标标签
                    for file_obj in files_to_update:
                        # 检查文件名中是否包含新标签名
                        if f'[{new_name}]' in file_obj.file_path:
                            if existing_tag not in file_obj.tags:
                                file_obj.tags.append(existing_tag)
                                print(f"Added target tag [{new_name}] to renamed file: {file_obj.file_path}")
                    
                    # 3. 删除原标签（因为已经合并到现有标签）
                    db.session.delete(tag)
                    db.session.commit()
                    
                    socketio.emit('tag_change_info', {
                        'message': f'标签 [{old_tag_name}] 已重命名为 [{new_name}]，与现有标签合并'
                    })
                    print(f"Merged tag [{old_tag_name}] into existing tag [{new_name}]")
                    
                else:
                    # 目标标签不存在，直接重命名当前标签
                    print(f"Renaming tag [{old_tag_name}] to [{new_name}]...")
                    
                    # 1. 重命名标签
                    tag.name = new_name
                    
                    # 2. 确保所有文件的标签关联正确
                    # 为包含新标签名的文件添加标签关联（如果尚未关联）
                    for file_obj in files_to_update:
                        if f'[{new_name}]' in file_obj.file_path:
                            if tag not in file_obj.tags:
                                file_obj.tags.append(tag)
                                print(f"Added renamed tag [{new_name}] to file: {file_obj.file_path}")
                    
                    db.session.commit()
                    socketio.emit('tag_change_info', {
                        'message': f'标签 [{old_tag_name}] 已重命名为 [{new_name}]'
                    })
                    print(f"Successfully renamed tag [{old_tag_name}] to [{new_name}]")
                    
            except Exception as e:
                socketio.emit('tag_change_error', {
                    'error': f"更新标签名称失败: {str(e)}"
                })
                db.session.rollback()
                print(f"Failed to rename tag [{old_tag_name}]: {e}")
        
        elif action == 'delete':
            # 删除操作：完全删除标签
            try:
                # 1. 从所有关联文件中移除此标签
                files_with_tag = list(tag.files)  # 创建副本避免迭代中修改
                for file_obj in files_with_tag:
                    if tag in file_obj.tags:
                        file_obj.tags.remove(tag)
                        print(f"Removed tag [{old_tag_name}] from file: {file_obj.file_path}")
                
                # 2. 删除标签本身（这会自动清理aliases等关联数据）
                db.session.delete(tag)
                db.session.commit()
                
                socketio.emit('tag_change_info', {
                    'message': f'已完全删除标签 [{old_tag_name}] 及其所有关联'
                })
                print(f"Completely deleted tag [{old_tag_name}] and all its associations")
                
            except Exception as e:
                socketio.emit('tag_change_error', {
                    'error': f"删除标签失败: {str(e)}"
                })
                db.session.rollback()
                print(f"Failed to delete tag [{old_tag_name}]: {e}")
        
        # 执行全面的索引同步，确保所有相关文件的标签关联与文件名一致
        try:
            socketio.emit('tag_change_progress', {
                'progress': 95,
                'current_file': '正在同步标签索引...',
                'total_files': total_files,
                'processed': total_files
            })
            
            # 对于删除操作，需要检查所有文件；对于重命名，重点检查处理过的文件
            if action == 'delete':
                # 删除操作：检查所有文件，确保已删除标签的关联被清理
                all_files = File.query.all()
                sync_count = sync_file_tag_indexes_after_delete(all_files, old_tag_name)
            else:
                # 重命名操作：检查处理过的文件，确保新标签关联正确
                sync_count = sync_file_tag_indexes_after_rename(files_to_update, old_tag_name, new_name)
            
            print(f"Synchronized tag indexes for {sync_count} changes")
            
            socketio.emit('tag_change_info', {
                'message': f'已同步标签索引，处理了 {sync_count} 个变更'
            })
        except Exception as e:
            print(f"Failed to sync tag indexes: {e}")
            socketio.emit('tag_change_error', {
                'error': f"同步标签索引失败: {str(e)}"
            })

        message = f'标签文件变更完成：成功处理 {success_count} 个文件'
        if error_count > 0:
            message += f'，{error_count} 个文件处理失败'
        
        complete_data = {'message': message}
        socketio.emit('tag_change_complete', complete_data)
        print(f"Emitted completion: {complete_data}")
        print(f"Tag file change task completed: {message}")
        return message


def sync_file_tag_indexes_after_delete(all_files, deleted_tag_name):
    """
    删除操作后的索引同步：确保已删除标签不再与任何文件关联
    """
    sync_count = 0
    
    # 由于标签已被删除，不需要检查新的关联，只需要确保没有遗留的无效关联
    # 这个操作主要是为了确保数据一致性，正常情况下删除标签会自动清理关联
    
    for file_obj in all_files:
        try:
            # 检查文件名中是否还包含已删除的标签
            filename = os.path.basename(file_obj.file_path)
            filename_tags = set(re.findall(r'\[([^\]]+)\]', filename))
            
            # 如果文件名中不包含已删除的标签，则不需要处理
            if deleted_tag_name not in filename_tags:
                continue
                
            # 如果文件名中仍然包含已删除的标签名，说明可能有其他同名标签
            # 尝试重新建立关联
            tag = Tag.query.filter(Tag.name.ilike(deleted_tag_name)).first()
            if tag and tag not in file_obj.tags:
                file_obj.tags.append(tag)
                print(f"Re-added tag [{deleted_tag_name}] to file: {file_obj.file_path}")
                sync_count += 1
            
            db.session.commit()
            
        except Exception as e:
            print(f"Failed to sync tags for file {file_obj.file_path}: {e}")
            db.session.rollback()
    
    return sync_count


def sync_file_tag_indexes_after_rename(files_to_process, old_tag_name, new_tag_name):
    """
    重命名操作后的索引同步：确保重命名后的标签关联正确
    """
    sync_count = 0
    
    for file_obj in files_to_process:
        try:
            # 从文件名中提取所有标签
            filename = os.path.basename(file_obj.file_path)
            filename_tags = set(re.findall(r'\[([^\]]+)\]', filename))
            
            # 获取数据库中当前关联的标签名称
            current_tag_names = set(tag.name for tag in file_obj.tags)
            
            # 检查是否需要添加新标签关联
            if new_tag_name in filename_tags and new_tag_name not in current_tag_names:
                # 查找新标签
                new_tag = Tag.query.filter(Tag.name.ilike(new_tag_name)).first()
                if new_tag and new_tag not in file_obj.tags:
                    file_obj.tags.append(new_tag)
                    print(f"Added renamed tag [{new_tag_name}] to file: {file_obj.file_path}")
                    sync_count += 1
            
            # 检查是否需要移除旧标签关联（如果文件名中不再包含）
            if old_tag_name not in filename_tags and old_tag_name in current_tag_names:
                # 查找并移除旧标签
                old_tags_to_remove = [tag for tag in file_obj.tags if tag.name == old_tag_name]
                for old_tag in old_tags_to_remove:
                    file_obj.tags.remove(old_tag)
                    print(f"Removed old tag [{old_tag_name}] from file: {file_obj.file_path}")
                    sync_count += 1
            
            # 执行通用的标签同步，确保文件名和标签关联完全一致
            general_sync_count = sync_file_tag_indexes_general([file_obj])
            sync_count += general_sync_count
            
            db.session.commit()
            
        except Exception as e:
            print(f"Failed to sync tags for file {file_obj.file_path}: {e}")
            db.session.rollback()
    
    return sync_count


def sync_file_tag_indexes_general(files_to_process):
    """
    通用的文件标签索引同步，确保数据库中的文件-标签关联与文件名中的标签完全一致
    """
    sync_count = 0
    
    for file_obj in files_to_process:
        try:
            # 从文件名中提取所有标签
            filename = os.path.basename(file_obj.file_path)
            filename_tags = set(re.findall(r'\[([^\]]+)\]', filename))
            
            # 获取数据库中当前关联的标签名称
            current_tag_names = set(tag.name for tag in file_obj.tags)
            
            # 找出需要添加和移除的标签
            tags_to_add = filename_tags - current_tag_names
            tags_to_remove = current_tag_names - filename_tags
            
            # 添加缺失的标签关联
            for tag_name in tags_to_add:
                # 查找对应的标签（包括别名）
                tag = Tag.query.filter(Tag.name.ilike(tag_name)).first()
                if not tag:
                    # 尝试通过别名查找
                    from ..models.manga import TagAlias
                    alias = TagAlias.query.filter(TagAlias.alias_name.ilike(tag_name)).first()
                    if alias:
                        tag = alias.tag
                
                if tag and tag not in file_obj.tags:
                    file_obj.tags.append(tag)
                    print(f"Added missing tag [{tag_name}] to file: {file_obj.file_path}")
                    sync_count += 1
            
            # 移除多余的标签关联
            tags_to_remove_objs = [tag for tag in file_obj.tags if tag.name in tags_to_remove]
            for tag in tags_to_remove_objs:
                file_obj.tags.remove(tag)
                print(f"Removed extra tag [{tag.name}] from file: {file_obj.file_path}")
                sync_count += 1
            
        except Exception as e:
            print(f"Failed to sync tags for file {file_obj.file_path}: {e}")
            db.session.rollback()
    
    return sync_count 