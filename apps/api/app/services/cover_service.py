import os
import tempfile
from dataclasses import dataclass
from typing import List, Optional

from PIL import Image
from loguru import logger

from ..infrastructure.archive_reader import ArchiveEntry, get_archive_entries, read_entry_stream


DEFAULT_COVER_FILENAMES = ['cover', '000', '0000', '封面']


@dataclass(frozen=True)
class CoverPathConfig:
    """封面缓存路径配置。"""

    base_dir: str
    shard_count: int


def get_cover_path(config: CoverPathConfig, file_id: int) -> str:
    """根据文件 ID 计算封面路径（支持分片目录）。"""
    shard_count = max(1, int(config.shard_count))
    shard_index = int(file_id) % shard_count
    shard_width = max(2, len(hex(shard_count - 1)) - 2)
    shard = f'{shard_index:0{shard_width}x}'
    return os.path.join(config.base_dir, shard, f'{int(file_id)}.webp')


def _select_cover_entry(entries: List[ArchiveEntry], preferred_names: List[str]) -> Optional[ArchiveEntry]:
    if not entries:
        return None

    preferred_set = {str(name).strip().lower() for name in preferred_names if str(name).strip()}
    for entry in entries:
        base = os.path.splitext(os.path.basename(entry.name))[0].strip().lower()
        if base in preferred_set:
            return entry
    return entries[0]


def generate_cover(
    *,
    file_id: int,
    file_path: str,
    config: CoverPathConfig,
    max_width: int,
    target_kb: int,
    quality_start: int,
    quality_min: int,
    quality_step: int,
    preferred_names: Optional[List[str]] = None,
    force: bool = False,
) -> bool:
    """
    生成并落盘封面（WebP）：
    - 仅解压 1 个候选页面
    - 原子写入，避免并发/中断导致封面损坏
    """
    cover_path = get_cover_path(config, file_id)
    cover_dir = os.path.dirname(cover_path)
    os.makedirs(cover_dir, exist_ok=True)

    if not force and os.path.exists(cover_path):
        return True

    preferred_names = preferred_names or DEFAULT_COVER_FILENAMES

    try:
        entries = get_archive_entries(file_path)
        entry = _select_cover_entry(entries, preferred_names=preferred_names)
        if entry is None:
            return False

        stream = read_entry_stream(file_path, entry)
        if stream is None:
            return False

        with Image.open(stream) as img:
            max_width = max(64, int(max_width))
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = max(1, int(img.height * ratio))
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # 统一转换，避免部分图片模式导致保存异常
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')

            quality = int(quality_start)
            quality_min = int(quality_min)
            quality_step = max(1, int(quality_step))
            target_kb = max(1, int(target_kb))

            tmp_fd, tmp_path = tempfile.mkstemp(prefix='cover_', suffix='.webp', dir=cover_dir)
            os.close(tmp_fd)

            try:
                while True:
                    img.save(tmp_path, 'webp', quality=quality, optimize=True)
                    file_size_kb = os.path.getsize(tmp_path) / 1024
                    if file_size_kb <= target_kb or quality <= quality_min:
                        break
                    quality = max(quality_min, quality - quality_step)

                os.replace(tmp_path, cover_path)
            finally:
                try:
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
                except OSError:
                    pass

        return True

    except Exception as exc:
        logger.warning('生成封面失败: {} | 错误: {}', os.path.basename(file_path), exc)
        return False

