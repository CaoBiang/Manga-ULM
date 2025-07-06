from flask import jsonify, request
from . import api
from sqlalchemy import func
from ..models import File
from .. import db
from .files import file_to_dict

@api.route('/maintenance/check-integrity', methods=['POST'])
def check_integrity():
    # TODO: Start a background task for integrity check
    return jsonify({'message': 'Integrity check started (placeholder)'}), 202

@api.route('/maintenance/duplicates', methods=['GET'])
def get_duplicates():
    """
    Finds and returns groups of files with identical content (based on file_hash).
    """
    # Find all hashes that appear more than once
    duplicate_hashes = db.session.query(File.file_hash, func.count(File.id).label('count')) \
        .group_by(File.file_hash) \
        .having(func.count(File.id) > 1) \
        .all()

    if not duplicate_hashes:
        return jsonify([])

    # For each duplicate hash, get the full file records
    results = []
    for hash_val, count in duplicate_hashes:
        files = File.query.filter_by(file_hash=hash_val).all()
        results.append([file_to_dict(f) for f in files])

    return jsonify(results)

@api.route('/maintenance/cleanup-missing', methods=['POST'])
def cleanup_missing():
    """
    Deletes records of missing files from the database based on a list of IDs.
    """
    data = request.get_json()
    if not data or 'ids' not in data or not isinstance(data['ids'], list):
        return jsonify({'error': 'A list of file IDs is required.'}), 400

    ids_to_delete = data['ids']
    if not ids_to_delete:
        return jsonify({'message': 'No IDs provided for deletion.'})

    # Ensure we only try to delete files that are actually marked as missing
    query = File.query.filter(File.id.in_(ids_to_delete), File.is_missing == True)
    
    deleted_count = query.delete(synchronize_session=False)
    db.session.commit()

    return jsonify({
        'message': f'Successfully deleted {deleted_count} missing file records.',
        'deleted_count': deleted_count
    }) 