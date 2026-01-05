from flask import request, jsonify
from . import api
from loguru import logger

from ...services.settings_service import (
    DEFAULT_SETTINGS,
    delete_setting_override,
    get_all_settings_with_defaults,
    get_setting_raw,
    set_setting_raw,
)

@api.route('/settings/<key>', methods=['GET'])
def get_setting(key):
    """获取指定设置值。"""
    value = get_setting_raw(key)
    if value is None and key not in DEFAULT_SETTINGS:
        return jsonify({key: None}), 404
    return jsonify({key: value})

@api.route('/settings/<key>', methods=['PUT'])
def set_setting(key):
    """创建或更新指定设置。"""
    payload = request.get_json(silent=True) or {}
    value = payload.get('value')
    try:
        stored = set_setting_raw(key, value)
        return jsonify({key: stored}), 200
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        logger.exception('写入设置失败: {} | 错误: {}', key, exc)
        return jsonify({'error': '写入设置失败'}), 500


@api.route('/settings/<key>', methods=['DELETE'])
def delete_setting(key):
    """删除指定设置（回退到默认值）。"""
    try:
        deleted = delete_setting_override(key)
        return jsonify({'deleted': deleted}), 200
    except Exception as exc:
        logger.exception('删除设置失败: {} | 错误: {}', key, exc)
        return jsonify({'error': '删除设置失败'}), 500

@api.route('/settings', methods=['GET'])
def get_all_settings():
    """获取全部设置（数据库覆盖默认值）。"""
    return jsonify(get_all_settings_with_defaults())
