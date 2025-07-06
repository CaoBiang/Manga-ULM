from flask import request, jsonify
from . import api
from .. import db
from ..models.manga import Config

@api.route('/settings/<key>', methods=['GET'])
def get_setting(key):
    """Gets a specific setting value."""
    setting = Config.query.get(key)
    if setting:
        return jsonify({key: setting.value})
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
    settings = Config.query.all()
    return jsonify({s.key: s.value for s in settings}) 