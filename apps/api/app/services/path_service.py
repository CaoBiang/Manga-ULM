from __future__ import annotations

import os
import re
from functools import lru_cache
from typing import Optional

# 说明：
# - Windows 下“映射网络盘符”（例如 V:）在不同进程/权限上下文中可能不可见（常见于管理员权限/UAC、服务进程）。
# - 统一将图书馆路径规范化为 UNC（例如 \\server\share\path），可避免扫描任务在后台进程中“扫描为空”。

_DRIVE_PATH_RE = re.compile(r'^[a-zA-Z]:[\\/]', re.ASCII)


def _strip_wrapping_quotes(raw_path: str) -> str:
    """去掉用户粘贴路径时可能带的首尾引号。"""
    path = str(raw_path or '').strip()
    if len(path) >= 2 and path[0] == path[-1] and path[0] in {'"', "'"}:
        return path[1:-1].strip()
    return path


def _normalize_basic(path: str) -> str:
    """基础归一化：展开变量/用户目录 + 绝对化 + 去冗余分隔符。"""
    path = _strip_wrapping_quotes(path)
    path = os.path.expandvars(os.path.expanduser(path))
    return os.path.abspath(os.path.normpath(path))


def _is_windows() -> bool:
    return os.name == 'nt'


def _is_drive_path(path: str) -> bool:
    return bool(_DRIVE_PATH_RE.match(path or ''))


@lru_cache(maxsize=256)
def try_resolve_unc_path(path: str) -> Optional[str]:
    """
    尝试把 Windows 映射盘符路径解析为 UNC 路径。

    - 输入：V:\\漫画\\extra
    - 输出：\\\\169.254.12.43\\ghs\\漫画\\extra

    若不是映射盘符，或解析失败，返回 None。
    """
    if not _is_windows():
        return None
    if not path:
        return None
    if path.startswith('\\\\'):
        return None
    if not _is_drive_path(path):
        return None

    try:
        import ctypes
        from ctypes import wintypes
    except Exception:
        return None

    # https://learn.microsoft.com/windows/win32/api/winnetwk/nf-winnetwk-wnetgetuniversalnamew
    UNIVERSAL_NAME_INFO_LEVEL = 0x00000001
    NO_ERROR = 0
    ERROR_MORE_DATA = 234

    class _UNIVERSAL_NAME_INFO(ctypes.Structure):
        _fields_ = [('lpUniversalName', wintypes.LPWSTR)]

    try:
        mpr = ctypes.WinDLL('mpr')
        func = mpr.WNetGetUniversalNameW
        func.argtypes = [
            wintypes.LPCWSTR,
            wintypes.DWORD,
            wintypes.LPVOID,
            ctypes.POINTER(wintypes.DWORD),
        ]
        func.restype = wintypes.DWORD
    except Exception:
        return None

    # 注意：WNetGetUniversalNameW 不支持用 NULL 缓冲区探测长度（会返回 87=ERROR_INVALID_PARAMETER）。
    # 采用“先给一个常用大小，不够再扩容”的策略。
    buf_size = wintypes.DWORD(1024)
    buf = ctypes.create_string_buffer(int(buf_size.value))
    result = func(path, UNIVERSAL_NAME_INFO_LEVEL, buf, ctypes.byref(buf_size))
    if result == ERROR_MORE_DATA and buf_size.value:
        buf = ctypes.create_string_buffer(int(buf_size.value))
        result = func(path, UNIVERSAL_NAME_INFO_LEVEL, buf, ctypes.byref(buf_size))
    if result != NO_ERROR:
        return None

    info = ctypes.cast(buf, ctypes.POINTER(_UNIVERSAL_NAME_INFO)).contents
    unc = info.lpUniversalName
    if not unc:
        return None
    return os.path.normpath(unc)


def normalize_library_path(raw_path: str) -> str:
    """
    图书馆路径归一化（用于 LibraryPath.path）：
    - 绝对化 + 归一化分隔符
    - Windows 下优先解析为 UNC（避免后台任务看不到映射盘）
    - 统一大小写（Windows 为大小写不敏感文件系统，数据库侧需要一致表示）
    """
    path = _normalize_basic(raw_path)
    if _is_windows() and _is_drive_path(path):
        unc = try_resolve_unc_path(path)
        if unc:
            path = unc
    return os.path.normcase(path) if _is_windows() else path


def normalize_file_path(raw_path: str) -> str:
    """
    文件路径归一化（用于 File.file_path）：
    - 绝对化 + 归一化分隔符
    - 统一大小写（Windows）

    注意：这里不做 UNC 解析，避免对每个文件路径重复调用系统 API；
    若 LibraryPath 已归一化为 UNC，则扫描得到的文件路径天然就是 UNC。
    """
    path = _normalize_basic(raw_path)
    return os.path.normcase(path) if _is_windows() else path
