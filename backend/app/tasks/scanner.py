import os
import io
import hashlib
import zipfile
import rarfile
import py7zr
import multiprocessing
from PIL import Image
from flask import current_app

from .. import huey, db, socketio
from ..models.manga import File
from .. import create_app # Import the app factory

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
    file_hash_for_cover = get_sha256_hash(file_path) # We need the hash for the cover name
    if not file_hash_for_cover:
        return False
        
    cover_filename = f"{file_hash_for_cover}.webp"
    cover_path = os.path.join(cover_cache_path, cover_filename)

    if os.path.exists(cover_path):
        return True # Cover already exists

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

    return {
        'status': 'ok',
        'file_path': file_path,
        'file_hash': file_hash,
        'file_size': file_size,
        'total_pages': total_pages,
        'spread_pages': spread_pages_json,
    }


@huey.task()
def start_scan_task(directory_path, max_workers=12):
    """
    Scans a directory for manga files, computes hashes, and adds them to the database.
    Uses multiprocessing for parallel processing.
    """
    app = create_app(os.getenv('FLASK_CONFIG') or 'default') # Create an app instance for the task
    with app.app_context():
        cover_cache_path = current_app.config['COVER_CACHE_PATH']

        socketio.emit('scan_progress', {'progress': 0, 'current_file': 'Starting scan...'})
        
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
        if total_files == 0:
            socketio.emit('scan_complete', {'message': 'Scan complete. No supported files found.'})
            return "Scan finished. No files found."
            
        processed_files = 0
        
        with multiprocessing.Pool(processes=max_workers) as pool:
            # Create a list of arguments for each task
            tasks = [(file_path, cover_cache_path) for file_path in all_files_to_scan]

            for result in pool.imap_unordered(process_file_task, tasks):
                processed_files += 1
                progress = (processed_files / total_files) * 100
                
                if result.get('status') == 'error':
                    socketio.emit('scan_error', {'error': f"Failed to process {result.get('file_path')}: {result.get('reason')}"})
                    continue

                file_path = result['file_path']
                file_hash = result['file_hash']
                
                socketio.emit('scan_progress', {'progress': progress, 'current_file': os.path.basename(file_path)})

                existing_file = File.query.filter_by(file_hash=file_hash).first()

                if existing_file:
                    # File exists, update its path and mark it as not missing
                    existing_file.file_path = file_path
                    existing_file.is_missing = False
                    # Re-analyze to get cover if it was missing (the worker already did this)
                    # We can add a check here if needed, but the worker should have created it.
                else:
                    # New file, add it to the database
                    new_file = File(
                        file_path=file_path,
                        file_hash=file_hash,
                        file_size=result['file_size'],
                        total_pages=result['total_pages'],
                        spread_pages=result['spread_pages'],
                        is_missing=False
                    )
                    db.session.add(new_file)
                
                # Commit per file to see progress, can be optimized to commit in batches
                db.session.commit()

        # 3. Handle files that are still marked as missing
        missing_files_count = File.query.filter_by(is_missing=True).count()
        print(f"Found {missing_files_count} missing files.")

        socketio.emit('scan_complete', {'message': f'Scan complete. Processed {total_files} files.'})

    return f"Scan finished for directory: {directory_path}" 