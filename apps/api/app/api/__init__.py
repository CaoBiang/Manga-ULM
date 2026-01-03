# -*- coding: utf-8 -*-
"""
API 包入口。

约定：
- `v1`：对外 HTTP API（挂载到 `/api/v1`）。
"""

from .v1 import api as api_v1

