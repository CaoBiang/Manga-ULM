from flask import request, jsonify
from . import api
from .. import db
from ..models.manga import Config

# Defaults ensure the frontend can safely read critical settings before they
# have been explicitly configured in the database.
DEFAULT_SETTINGS = {
    'scan.max_workers': '12',
}

@api.route('/settings/<key>', methods=['GET'])
def get_setting(key):
    """Gets a specific setting value."""
    setting = Config.query.get(key)
    if setting:
        return jsonify({key: setting.value})
    if key in DEFAULT_SETTINGS:
        return jsonify({key: DEFAULT_SETTINGS[key]})
    return jsonify({key: None}), 404

@api.route('/settings/<key>', methods=['POST'])
def set_setting(key):
    """Creates or updates a specific setting."""
    value = request.json.get('value')
    if value is None:
        return jsonify({'error': 'Value is required'}), 400
    
    setting = Config.query.get(key)
    if setting:
        setting.value = str(value)
    else:
        setting = Config(key=key, value=str(value))
        db.session.add(setting)
    
    db.session.commit()
    return jsonify({key: setting.value}), 200

@api.route('/settings', methods=['GET'])
def get_all_settings():
    """Gets all settings."""
    settings = {s.key: s.value for s in Config.query.all()}
    for key, value in DEFAULT_SETTINGS.items():
        settings.setdefault(key, value)
    return jsonify(settings) 
