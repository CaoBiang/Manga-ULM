# 使 tasks 目录成为 Python 包，并集中导入 Huey 任务以完成注册。

from .scanner import start_scan_task
from .rename import batch_rename_task, tag_file_change_task, tag_split_task 
