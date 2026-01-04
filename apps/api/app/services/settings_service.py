from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from loguru import logger

from .. import db
from ..models.manga import Config


# 说明：
# - Config 表以 Key-Value 形式持久化设置，值统一存为字符串，便于在前后端保持一致。
# - DEFAULT_SETTINGS 用于“开箱即用”，即便数据库没有写入任何配置也能正常运行。
DEFAULT_SETTINGS: Dict[str, str] = {
    # 扫描
    'scan.max_workers': '12',
    'scan.hash.mode': 'full',
    'scan.cancel_check.interval_ms': '200',
    # 封面生成
    'scan.cover.mode': 'scan',
    'scan.cover.regenerate_missing': '1',
    'scan.cover.max_width': '500',
    'scan.cover.target_kb': '300',
    'scan.cover.quality_start': '80',
    'scan.cover.quality_min': '10',
    'scan.cover.quality_step': '10',
    # 封面缓存
    'cover.cache.shard_count': '256',
    # 阅读：后端流式输出
    'reader.stream.chunk_kb': '512',
    # 通用：界面与体验
    'ui.language': 'zh',
    'ui.library.view_mode': 'grid',
    'ui.library.pagination.per_page': '50',
    'ui.library.lazy_load.root_margin_px': '600',
    # 阅读：前端体验
    'ui.reader.preload_ahead': '2',
    'ui.reader.split_view.default_enabled': '0',
    'ui.reader.wide_ratio_threshold': '1.0',
    'ui.reader.toolbar.animation_ms': '240',
    'ui.reader.toolbar.background_opacity': '0.72',
    'ui.reader.toolbar.center_click_toggle_enabled': '1',
    # 阅读：点击区域（左/中/右）
    'ui.reader.tap_zones': '{"version":1,"boundaries":{"left":0.3,"right":0.7},"actions":{"left":"prev_page","middle":"toggle_toolbar","right":"next_page"}}',
    # 重命名
    'rename.filename_template': '',
    # 图书馆：网格列数（按断点）
    'ui.library.grid.columns': '{"base":2,"sm":3,"md":4,"lg":5,"xl":6,"2xl":8}',
    # 图书馆：卡片展示字段（按视图模式）
    'ui.library.card.fields': '{"grid":["reading_status_tag","file_size","progress_percent","progress_bar","progress_summary","total_pages","last_read_date"],"list":["reading_status_tag","total_pages","file_size","last_read_date"]}',
    # 图书馆：作者标签类型（用于从标签中提取“作者”显示）
    'ui.library.card.author_tag_type_id': '',
    'ui.reader.ui.blur_enabled': '1',
    'ui.reader.ui.blur_radius_px': '12',
    'ui.reader.ui.control_bg_opacity': '0.46',
    'ui.reader.ui.control_border_opacity': '0.16',
    # 管理器（非阅读器）：毛玻璃外观
    'ui.manager.ui.blur_enabled': '1',
    'ui.manager.ui.blur_radius_px': '10',
    'ui.manager.ui.surface_bg_opacity': '0.72',
    'ui.manager.ui.surface_border_opacity': '0.14',
    'ui.manager.ui.control_bg_opacity': '0.6',
    'ui.manager.ui.control_border_opacity': '0.14',
}


def get_setting_raw(key: str) -> Optional[str]:
    """读取设置原始字符串（包含默认值兜底）。"""
    setting = Config.query.get(key)
    if setting and setting.value is not None:
        return setting.value
    return DEFAULT_SETTINGS.get(key)


def get_setting_raw_without_default(key: str) -> Optional[str]:
    """仅从数据库读取设置，不使用默认值。"""
    setting = Config.query.get(key)
    return setting.value if setting else None


def get_all_settings_with_defaults() -> Dict[str, str]:
    """返回所有设置（数据库覆盖默认值）。"""
    settings = {row.key: row.value for row in Config.query.all()}
    for key, value in DEFAULT_SETTINGS.items():
        settings.setdefault(key, value)
    return settings


def set_setting_raw(key: str, value: Any) -> str:
    """创建或更新设置，统一存为字符串。"""
    if value is None:
        raise ValueError('必须提供 value')

    stored = str(value)
    setting = Config.query.get(key)
    if setting:
        setting.value = stored
    else:
        setting = Config(key=key, value=stored)
        db.session.add(setting)
    db.session.commit()
    return stored


def delete_setting_override(key: str) -> bool:
    """删除数据库覆盖项（回退到默认值），返回是否确实删除了记录。"""
    setting = Config.query.get(key)
    if not setting:
        return False
    db.session.delete(setting)
    db.session.commit()
    return True


def _to_int(raw_value: Optional[str]) -> Optional[int]:
    if raw_value is None or raw_value == '':
        return None
    try:
        return int(str(raw_value).strip())
    except ValueError:
        return None


def _to_float(raw_value: Optional[str]) -> Optional[float]:
    if raw_value is None or raw_value == '':
        return None
    try:
        return float(str(raw_value).strip())
    except ValueError:
        return None


def _to_bool(raw_value: Optional[str]) -> Optional[bool]:
    if raw_value is None or raw_value == '':
        return None
    value = str(raw_value).strip().lower()
    if value in {'1', 'true', 'yes', 'y', 'on'}:
        return True
    if value in {'0', 'false', 'no', 'n', 'off'}:
        return False
    return None


def get_int_setting(key: str, *, default: int, min_value: int, max_value: int) -> int:
    raw_value = get_setting_raw(key)
    parsed = _to_int(raw_value)
    if parsed is None:
        return default
    return max(min_value, min(max_value, parsed))


def get_float_setting(key: str, *, default: float, min_value: float, max_value: float) -> float:
    raw_value = get_setting_raw(key)
    parsed = _to_float(raw_value)
    if parsed is None:
        return default
    return max(min_value, min(max_value, parsed))


def get_bool_setting(key: str, *, default: bool) -> bool:
    raw_value = get_setting_raw(key)
    parsed = _to_bool(raw_value)
    return default if parsed is None else parsed


def get_str_setting(key: str, *, default: str = '') -> str:
    raw_value = get_setting_raw(key)
    if raw_value is None:
        return default
    return str(raw_value)


@dataclass(frozen=True)
class ScanCoverSettings:
    max_width: int
    target_kb: int
    quality_start: int
    quality_min: int
    quality_step: int


@dataclass(frozen=True)
class ScanSettings:
    max_workers: int
    hash_mode: str
    cover_mode: str
    cover_regenerate_missing: bool
    cancel_check_interval_ms: int
    cover: ScanCoverSettings


def get_scan_settings() -> ScanSettings:
    raw_hash_mode = get_str_setting('scan.hash.mode', default='full').strip().lower()
    hash_mode = raw_hash_mode if raw_hash_mode in {'full', 'off'} else 'full'

    raw_cover_mode = get_str_setting('scan.cover.mode', default='scan').strip().lower()
    cover_mode = raw_cover_mode if raw_cover_mode in {'scan', 'off'} else 'scan'

    cover_regenerate_missing = get_bool_setting('scan.cover.regenerate_missing', default=True)
    cancel_check_interval_ms = get_int_setting(
        'scan.cancel_check.interval_ms',
        default=200,
        min_value=50,
        max_value=5000,
    )
    settings = ScanSettings(
        max_workers=get_int_setting('scan.max_workers', default=12, min_value=1, max_value=128),
        hash_mode=hash_mode,
        cover_mode=cover_mode,
        cover_regenerate_missing=cover_regenerate_missing,
        cancel_check_interval_ms=cancel_check_interval_ms,
        cover=ScanCoverSettings(
            max_width=get_int_setting('scan.cover.max_width', default=500, min_value=64, max_value=4000),
            target_kb=get_int_setting('scan.cover.target_kb', default=300, min_value=50, max_value=5000),
            quality_start=get_int_setting('scan.cover.quality_start', default=80, min_value=1, max_value=100),
            quality_min=get_int_setting('scan.cover.quality_min', default=10, min_value=1, max_value=100),
            quality_step=get_int_setting('scan.cover.quality_step', default=10, min_value=1, max_value=50),
        ),
    )
    if settings.cover.quality_min > settings.cover.quality_start:
        logger.warning(
            '封面质量参数不合理，已自动回退: quality_min={} quality_start={}',
            settings.cover.quality_min,
            settings.cover.quality_start,
        )
        return ScanSettings(
            max_workers=settings.max_workers,
            hash_mode=settings.hash_mode,
            cover_mode=settings.cover_mode,
            cover_regenerate_missing=settings.cover_regenerate_missing,
            cancel_check_interval_ms=settings.cancel_check_interval_ms,
            cover=ScanCoverSettings(
                max_width=settings.cover.max_width,
                target_kb=settings.cover.target_kb,
                quality_start=settings.cover.quality_start,
                quality_min=min(settings.cover.quality_min, settings.cover.quality_start),
                quality_step=settings.cover.quality_step,
            ),
        )
    return settings


def get_cover_cache_shard_count() -> int:
    """封面缓存分片目录数量（用于避免单目录文件过多）。"""
    return get_int_setting('cover.cache.shard_count', default=256, min_value=1, max_value=4096)
