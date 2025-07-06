import os
import re
from .. import huey, db, socketio
from ..models import File, Tag

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