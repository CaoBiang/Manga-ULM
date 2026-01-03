#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重启 Huey Worker 的辅助脚本（Windows 优先）。

注意：
- 本脚本会尝试结束当前正在运行的 Huey Worker 进程，然后在后台重新启动。
- 如果自动重启失败，会输出手动启动命令。
"""

from __future__ import annotations

import os
import subprocess
import sys
import time


def restart_worker() -> None:
    print("正在重启 Huey Worker…")

    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq python.exe"],
            capture_output=True,
            text=True,
            check=False,
        )

        if "huey_consumer" in (result.stdout or ""):
            print("发现正在运行的 Worker，准备终止…")
            subprocess.run(
                ["taskkill", "/F", "/IM", "python.exe"],
                capture_output=True,
                text=True,
                check=False,
            )
            time.sleep(2)
    except Exception as exc:
        print(f"终止进程时出错：{exc}")

    try:
        print("启动新的 Huey Worker…")
        worker_cmd = [
            sys.executable,
            "-m",
            "huey.bin.huey_consumer",
            "app.huey",
            "--workers=1",
        ]

        subprocess.Popen(
            worker_cmd,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        print("Huey Worker 已重启。")
    except Exception as exc:
        print(f"启动 Worker 时出错：{exc}")
        print("请手动执行：")
        print(r"cd apps\api")
        print("python -m huey.bin.huey_consumer app.huey --workers=1")


if __name__ == "__main__":
    restart_worker()
