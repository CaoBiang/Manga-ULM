import os
import io
import hashlib
import zipfile
import rarfile
import py7zr
import multiprocessing
import re
import datetime
from PIL import Image
from flask import current_app

from .. import huey, db, socketio
from ..models.manga import File, Tag
from .. import create_app

SUPPORTED_EXTENSIONS = ['.zip', '.cbz', '.rar', '.cbr', '.7z', '.cb7']
IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
COVER_FILENAMES = ['cover', '000', '0000', '封面']

def is_image_file(filename):
    return any(filename.lower().endswith(ext) for ext in IMAGE_EXTENSIONS)

def get_sha256_hash(file_path):
    """Computes the SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    try:
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()
    except IOError:
        socketio.emit('scan_error', {'error': f'Could not read file: {file_path}'})
        return None

def analyze_archive(file_path, cover_cache_path):
    """
    Analyzes a compressed archive to extract metadata.
    - Counts the number of image pages.
    - Identifies spread pages (wide images).
    - Intelligently extracts and saves a cover image.
    Returns a dictionary with total_pages, spread_pages_json, and cover_saved_path.
    """
    ext = os.path.splitext(file_path)[1].lower()
    page_count = 0
    spread_pages = []
    cover_candidates = []

    try:
        if ext in ['.zip', '.cbz']:
            with zipfile.ZipFile(file_path, 'r') as archive:
                image_list = sorted([name for name in archive.namelist() if is_image_file(name) and not name.startswith('__MACOSX')])
                page_count = len(image_list)
                for i, image_name in enumerate(image_list):
                    with archive.open(image_name) as image_file:
                        img = Image.open(io.BytesIO(image_file.read()))
                        if img.width > img.height * 1.5:
                            spread_pages.append(i)
                        cover_candidates.append({'name': image_name, 'index': i, 'size': img.size})
        
        elif ext in ['.rar', '.cbr']:
            with rarfile.RarFile(file_path, 'r') as archive:
                image_list = sorted([info.filename for info in archive.infolist() if is_image_file(info.filename) and not info.isdir()])
                page_count = len(image_list)
                for i, image_name in enumerate(image_list):
                    with archive.open(image_name) as image_file:
                        img = Image.open(io.BytesIO(image_file.read()))
                        if img.width > img.height * 1.5:
                            spread_pages.append(i)
                        cover_candidates.append({'name': image_name, 'index': i, 'size': img.size})

        elif ext in ['.7z', '.cb7']:
            with py7zr.SevenZipFile(file_path, 'r') as archive:
                all_files = archive.readall()
                image_list = sorted([name for name, bio in all_files.items() if is_image_file(name) and bio.get('is_directory') is not True])
                page_count = len(image_list)
                for i, image_name in enumerate(image_list):
                    with all_files[image_name] as image_file:
                        img = Image.open(image_file)
                        if img.width > img.height * 1.5:
                            spread_pages.append(i)
                        cover_candidates.append({'name': image_name, 'index': i, 'size': img.size})

    except Exception as e:
        socketio.emit('scan_error', {'error': f'Failed to analyze archive {os.path.basename(file_path)}: {e}'})
        return None

    # Find and save the best cover
    cover_saved = save_cover_from_candidates(file_path, cover_candidates, cover_cache_path)
    
    return page_count, str(spread_pages), cover_saved

def save_cover_from_candidates(file_path, candidates, cover_cache_path):
    """Finds the best cover from a list of candidates and saves it."""
    if not candidates:
        return False

    # Heuristic: prefer specific filenames, then first page.
    best_candidate = None
    for cand in candidates:
        name_no_ext = os.path.splitext(os.path.basename(cand['name']))[0].lower()
        if name_no_ext in COVER_FILENAMES:
            best_candidate = cand
            break
    
    if not best_candidate:
        # Fallback to the first image in the archive
        candidates.sort(key=lambda x: x['index'])
        best_candidate = candidates[0]

    # Extract and save the cover
    file_hash_for_cover = get_sha256_hash(file_path)
    if not file_hash_for_cover:
        return False
        
    cover_filename = f"{file_hash_for_cover}.webp"
    cover_path = os.path.join(cover_cache_path, cover_filename)

    if os.path.exists(cover_path):
        return True

    ext = os.path.splitext(file_path)[1].lower()
    try:
        image_data = None
        if ext in ['.zip', '.cbz']:
            with zipfile.ZipFile(file_path, 'r') as archive:
                image_data = archive.read(best_candidate['name'])
        elif ext in ['.rar', '.cbr']:
            with rarfile.RarFile(file_path, 'r') as archive:
                image_data = archive.read(best_candidate['name'])
        elif ext in ['.7z', '.cb7']:
             with py7zr.SevenZipFile(file_path, 'r') as archive:
                image_data = archive.readall()[best_candidate['name']].read()

        if image_data:
            img = Image.open(io.BytesIO(image_data))
            
            # Image optimization
            max_width = 500
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # Save with optimized settings
            img.save(cover_path, 'webp', quality=80, optimize=True)
            
            # Check file size and adjust quality if necessary
            file_size_kb = os.path.getsize(cover_path) / 1024
            quality = 80
            while file_size_kb > 300 and quality > 10:
                quality -= 10
                img.save(cover_path, 'webp', quality=quality, optimize=True)
                file_size_kb = os.path.getsize(cover_path) / 1024

            return True

    except Exception as e:
        socketio.emit('scan_error', {'error': f'Failed to save cover for {os.path.basename(file_path)}: {e}'})
        return False
    
    return False

def process_file_task(args):
    """Worker task to process a single file."""
    file_path, cover_cache_path = args
    file_hash = get_sha256_hash(file_path)
    if not file_hash:
        return {'status': 'error', 'file_path': file_path, 'reason': 'hash_failed'}

    # This part runs in a separate process, so it can't query the database directly.
    # We will return the data and process it in the main thread.
    analysis_result = analyze_archive(file_path, cover_cache_path)
    if analysis_result is None:
        return {'status': 'error', 'file_path': file_path, 'reason': 'analysis_failed'}
        
    total_pages, spread_pages_json, _ = analysis_result
    file_size = os.path.getsize(file_path)

    # Extract tags from filename
    filename = os.path.basename(file_path)
    tag_names = re.findall(r'\[(.*?)\]', filename)

    return {
        'status': 'ok',
        'file_path': file_path,
        'file_hash': file_hash,
        'file_size': file_size,
        'total_pages': total_pages,
        'spread_pages': spread_pages_json,
        'tag_names': tag_names,
    }

@huey.task()
def start_scan_task(directory_path, max_workers=12, task_db_id=None):
    """
    Scans a directory for manga files, computes hashes, and adds them to the database.
    Uses multiprocessing for parallel processing.
    """
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        # Import here to avoid circular imports
        from ..models.manga import Task
        
        # Get task record from database
        task_record = None
        if task_db_id:
            task_record = Task.query.get(task_db_id)
            if task_record:
                task_record.status = 'running'
                task_record.started_at = datetime.datetime.utcnow()
                db.session.commit()
        
        cover_cache_path = current_app.config['COVER_CACHE_PATH']

        socketio.emit('scan_progress', {
            'progress': 0, 
            'current_file': 'Starting scan...',
            'task_id': task_db_id
        })
        
        try:
            # 1. Mark existing files in this path as missing
            File.query.filter(File.file_path.startswith(directory_path)).update({'is_missing': True})
            db.session.commit()

            # 2. Walk the directory and find all files
            all_files_to_scan = []
            for root, _, files in os.walk(directory_path):
                for file in files:
                    if os.path.splitext(file)[1].lower() in SUPPORTED_EXTENSIONS:
                        all_files_to_scan.append(os.path.join(root, file))

            total_files = len(all_files_to_scan)
            
            # Update task record with total files count
            if task_record:
                task_record.total_files = total_files
                db.session.commit()
            
            if total_files == 0:
                socketio.emit('scan_complete', {
                    'message': 'Scan complete. No supported files found.',
                    'task_id': task_db_id
                })
                if task_record:
                    task_record.status = 'completed'
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()
                return "Scan finished. No files found."
                
            processed_files = 0
        
            with multiprocessing.Pool(processes=max_workers) as pool:
                # Create a list of arguments for each task
                tasks = [(file_path, cover_cache_path) for file_path in all_files_to_scan]

                for i, result in enumerate(pool.imap_unordered(process_file_task, tasks), 1):
                    if result['status'] == 'ok':
                        try:
                            # Check if file with this hash already exists
                            file_record = File.query.filter_by(file_hash=result['file_hash']).first()
                            
                            if file_record:
                                # File exists, update its path and mark it as not missing
                                file_record.file_path = result['file_path']
                                file_record.is_missing = False
                            else:
                                # New file, create a new record
                                file_record = File(
                                    file_path=result['file_path'],
                                    file_hash=result['file_hash'],
                                    file_size=result['file_size'],
                                    total_pages=result['total_pages'],
                                    spread_pages=result['spread_pages']
                                )
                                db.session.add(file_record)
                            
                            # This needs to be after add/commit so that file_record has an ID
                            db.session.flush()

                            # Handle tags
                            if result.get('tag_names'):
                                # Clear existing tags before adding new ones from filename
                                file_record.tags.clear()
                                for tag_name in result['tag_names']:
                                    tag = Tag.query.filter(Tag.name.ilike(tag_name)).first()
                                    if tag and tag not in file_record.tags:
                                        file_record.tags.append(tag)

                            db.session.commit()
                            
                            processed_files += 1
                            
                            # Update task record progress
                            if task_record:
                                task_record.progress = (i / total_files) * 100
                                task_record.processed_files = processed_files
                                task_record.current_file = f"Processed: {os.path.basename(result['file_path'])}"
                                db.session.commit()
                            
                            socketio.emit('scan_progress', {
                                'progress': (i / total_files) * 100,
                                'current_file': f"Processed: {os.path.basename(result['file_path'])}",
                                'task_id': task_db_id
                            })
                        except Exception as e:
                            db.session.rollback()
                            error_msg = f'DB Error for {os.path.basename(result["file_path"])}: {e}'
                            socketio.emit('scan_error', {'error': error_msg, 'task_id': task_db_id})
                            
                            # Update task record with error
                            if task_record:
                                task_record.error_message = error_msg
                                db.session.commit()
                    else:
                        error_msg = f'Failed to process {os.path.basename(result.get("file_path", "Unknown"))}: {result.get("reason", "Unknown")}'
                        socketio.emit('scan_error', {'error': error_msg, 'task_id': task_db_id})
                        
                        # Update task record with error
                        if task_record:
                            task_record.error_message = error_msg
                            db.session.commit()

                # 3. Handle files that are still marked as missing
                missing_files_count = File.query.filter_by(is_missing=True).count()
                print(f"Found {missing_files_count} missing files.")

                # Task completed successfully
                if task_record:
                    task_record.status = 'completed'
                    task_record.progress = 100.0
                    task_record.finished_at = datetime.datetime.utcnow()
                    db.session.commit()

                socketio.emit('scan_complete', {
                    'message': f'Scan complete. Processed {total_files} files.',
                    'task_id': task_db_id
                })

        except Exception as e:
            # Handle any unexpected errors
            error_msg = f'Scan failed: {str(e)}'
            socketio.emit('scan_error', {'error': error_msg, 'task_id': task_db_id})
            
            if task_record:
                task_record.status = 'failed'
                task_record.error_message = error_msg
                task_record.finished_at = datetime.datetime.utcnow()
                db.session.commit()
            
            raise

    return f"Scan finished for directory: {directory_path}" 