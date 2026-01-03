import io
import os
import re
import zipfile
import rarfile
import py7zr
from dataclasses import dataclass
from functools import lru_cache
from typing import Generator, List, Optional, Tuple
from loguru import logger

# 统一的压缩包与图片后缀清单，确保扫描与阅读行为一致
SUPPORTED_ARCHIVE_EXTENSIONS = ('.zip', '.cbz', '.rar', '.cbr', '.7z', '.cb7')
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp')


@dataclass(frozen=True)
class ArchiveEntry:
    """描述单个页面条目的轻量结构体。"""
    name: str
    size: Optional[int] = None


def natural_sort_key(value: str) -> List[object]:
    """自然排序 key，保证 1,2,10 这样的文件顺序正确。"""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'([0-9]+)', value)]


def _is_image_file(name: str) -> bool:
    return any(name.lower().endswith(ext) for ext in IMAGE_EXTENSIONS)


def _file_signature(file_path: str) -> Tuple[int, int]:
    """使用文件大小与 mtime 作为缓存签名，文件变更会自动失效。"""
    stat = os.stat(file_path)
    return int(stat.st_mtime), int(stat.st_size)


@lru_cache(maxsize=256)
def _build_archive_index(file_path: str, mtime: int, size: int) -> Tuple[ArchiveEntry, ...]:
    """
    读取压缩包目录索引而非内容，返回排序后的页面列表。
    利用 LRU 缓存避免重复读取目录，适合高频翻页场景。
    """
    ext = os.path.splitext(file_path)[1].lower()
    entries: List[ArchiveEntry] = []

    try:
        if ext in ('.zip', '.cbz'):
            with zipfile.ZipFile(file_path, 'r') as archive:
                for info in archive.infolist():
                    if getattr(info, 'is_dir', lambda: False)():
                        continue
                    if not _is_image_file(info.filename):
                        continue
                    if info.filename.startswith('__MACOSX'):
                        continue
                    entries.append(ArchiveEntry(name=info.filename, size=getattr(info, 'file_size', None)))

        elif ext in ('.rar', '.cbr'):
            with rarfile.RarFile(file_path, 'r') as archive:
                for info in archive.infolist():
                    if info.isdir():
                        continue
                    if not _is_image_file(info.filename):
                        continue
                    entries.append(ArchiveEntry(name=info.filename, size=getattr(info, 'file_size', None)))

        elif ext in ('.7z', '.cb7'):
            with py7zr.SevenZipFile(file_path, 'r') as archive:
                for info in archive.list():
                    if getattr(info, 'is_directory', False):
                        continue
                    if not _is_image_file(info.filename):
                        continue
                    # py7zr 的条目信息中 uncompressed 为解压后大小，可能为 None
                    entries.append(ArchiveEntry(name=info.filename, size=getattr(info, 'uncompressed', None)))
        else:
            raise ValueError(f'不支持的压缩格式: {ext}')

        entries.sort(key=lambda item: natural_sort_key(item.name))
        return tuple(entries)
    except Exception as exc:
        logger.exception('读取压缩包目录失败: {} | 错误: {}', file_path, exc)
        raise


def get_archive_entries(file_path: str) -> List[ArchiveEntry]:
    """获取排序后的图片条目列表（使用缓存）。"""
    mtime, size = _file_signature(file_path)
    return list(_build_archive_index(file_path, mtime, size))


def get_entry_by_index(file_path: str, page_num: int) -> Optional[ArchiveEntry]:
    """根据页码安全获取条目，不抛异常。"""
    entries = get_archive_entries(file_path)
    if page_num < 0 or page_num >= len(entries):
        return None
    return entries[page_num]


def guess_mimetype(entry_name: str) -> str:
    """根据文件后缀推断 MIME 类型，默认 image/jpeg。"""
    ext = os.path.splitext(entry_name)[1].lower()
    if ext in ('.jpg', '.jpeg'):
        return 'image/jpeg'
    if ext == '.png':
        return 'image/png'
    if ext == '.gif':
        return 'image/gif'
    if ext == '.webp':
        return 'image/webp'
    return 'image/jpeg'


def _read_entry_bytes(file_path: str, entry: ArchiveEntry) -> Optional[io.BytesIO]:
    """按条目解压单页到内存，不触碰其他页面。"""
    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext in ('.zip', '.cbz'):
            with zipfile.ZipFile(file_path, 'r') as archive:
                return io.BytesIO(archive.read(entry.name))

        if ext in ('.rar', '.cbr'):
            with rarfile.RarFile(file_path, 'r') as archive:
                return io.BytesIO(archive.read(entry.name))

        if ext in ('.7z', '.cb7'):
            with py7zr.SevenZipFile(file_path, 'r') as archive:
                content_map = archive.read([entry.name])
                data = content_map.get(entry.name)
                if data is None:
                    return None
                # py7zr 返回的 BinaryIO 需要读出字节以免句柄在上下文关闭后失效
                return io.BytesIO(data.read())

    except Exception as exc:
        logger.warning('解压页面失败: {} | 条目: {} | 错误: {}', file_path, entry.name, exc)
        return None
    return None


@lru_cache(maxsize=1024)
def _resolve_entry_size(file_path: str, mtime: int, file_size: int, entry_name: str, indexed_size: Optional[int]) -> Optional[int]:
    """
    优先使用索引大小；缺失时单独解压一次获取长度，并缓存避免重复开销。
    """
    if indexed_size is not None:
        return indexed_size

    entry = ArchiveEntry(name=entry_name, size=None)
    stream = _read_entry_bytes(file_path, entry)
    if stream is None:
        return None
    return stream.getbuffer().nbytes


def get_entry_metadata(file_path: str, page_num: int) -> Optional[Tuple[str, Optional[int]]]:
    """返回指定页的文件名与大小（尽可能使用缓存，避免整本解压）。"""
    entry = get_entry_by_index(file_path, page_num)
    if entry is None:
        return None

    mtime, size = _file_signature(file_path)
    resolved_size = _resolve_entry_size(file_path, mtime, size, entry.name, entry.size)
    return entry.name, resolved_size


def iter_entry_chunks(file_path: str, entry: ArchiveEntry, chunk_size: int = 512 * 1024) -> Generator[bytes, None, None]:
    """
    流式读取单页内容，Zip/RAR 走逐块解压，7z 降级为内存块输出。
    供 Flask Response 使用，避免一次性堆积内存。
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ('.zip', '.cbz'):
        archive = zipfile.ZipFile(file_path, 'r')
        file_obj = archive.open(entry.name, 'r')
    elif ext in ('.rar', '.cbr'):
        archive = rarfile.RarFile(file_path, 'r')
        file_obj = archive.open(entry.name)
    elif ext in ('.7z', '.cb7'):
        archive = py7zr.SevenZipFile(file_path, 'r')
        content_map = archive.read([entry.name])
        file_obj = content_map.get(entry.name)
        if file_obj is None:
            archive.close()
            return
    else:
        logger.error('不支持的压缩格式: {}', ext)
        return

    try:
        while True:
            chunk = file_obj.read(chunk_size)
            if not chunk:
                break
            yield chunk
    except Exception as exc:
        logger.warning('流式读取页面失败: {} | 条目: {} | 错误: {}', file_path, entry.name, exc)
    finally:
        try:
            file_obj.close()
        except Exception:
            pass
        try:
            archive.close()
        except Exception:
            pass


def read_entry_stream(file_path: str, entry: ArchiveEntry) -> Optional[io.BytesIO]:
    """公开的简化包装，供业务按需读取单页字节流。"""
    return _read_entry_bytes(file_path, entry)
