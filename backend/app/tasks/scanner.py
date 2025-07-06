import os
import io
import hashlib
import zipfile
import rarfile
import py7zr
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
        return 0, '[]', False

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
            img.save(cover_path, 'webp', quality=85)
            return True

    except Exception as e:
        socketio.emit('scan_error', {'error': f'Failed to save cover for {os.path.basename(file_path)}: {e}'})
        return False
    
    return False


@huey.task()
def start_scan_task(directory_path):
    """
    Scans a directory for manga files, computes hashes, and adds them to the database.
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

        for file_path in all_files_to_scan:
            processed_files += 1
            progress = (processed_files / total_files) * 100
            socketio.emit('scan_progress', {'progress': progress, 'current_file': os.path.basename(file_path)})

            file_hash = get_sha256_hash(file_path)
            if not file_hash:
                continue # Error already emitted

            existing_file = File.query.filter_by(file_hash=file_hash).first()

            if existing_file:
                # File exists, update its path and mark it as not missing
                existing_file.file_path = file_path
                existing_file.is_missing = False
                # Re-analyze to get cover if it was missing
                if not os.path.exists(os.path.join(cover_cache_path, f"{file_hash}.webp")):
                    analyze_archive(file_path, cover_cache_path)
            else:
                # New file, add it to the database
                file_size = os.path.getsize(file_path)
                total_pages, spread_pages_json, _ = analyze_archive(file_path, cover_cache_path)
                
                new_file = File(
                    file_path=file_path,
                    file_hash=file_hash,
                    file_size=file_size,
                    total_pages=total_pages,
                    spread_pages=spread_pages_json,
                    is_missing=False
                )
                db.session.add(new_file)
            
            db.session.commit()

        # 3. Handle files that are still marked as missing
        missing_files_count = File.query.filter_by(is_missing=True).count()
        # You could emit another event here for the sync report
        print(f"Found {missing_files_count} missing files.")

        socketio.emit('scan_complete', {'message': f'Scan complete. Processed {total_files} files.'})

    return f"Scan finished for directory: {directory_path}" 