# -*- coding: utf-8 -*-
"""
Socket.IO 事件注册。

说明：
- 与 HTTP API（`app/api/v1`）分离，避免把实时事件与 REST 路由混在同一层。
"""

from __future__ import annotations

from .. import socketio


@socketio.on("test_event")
def handle_test_event(data):
    print(f"收到 test_event：{data}")
    socketio.emit("test_response", {"status": "success", "message": "Socket.IO 工作正常"})

