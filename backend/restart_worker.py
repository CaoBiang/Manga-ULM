#!/usr/bin/env python3
"""
重启Huey worker的脚本
"""
import os
import sys
import subprocess
import time

def restart_worker():
    """重启Huey worker进程"""
    print("正在重启Huey worker...")
    
    # 查找并终止现有的worker进程
    try:
        # 在Windows上查找huey_consumer进程
        result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq python.exe'], 
                              capture_output=True, text=True)
        
        if 'huey_consumer' in result.stdout:
            print("发现现有的worker进程，正在终止...")
            subprocess.run(['taskkill', '/F', '/IM', 'python.exe'], 
                         capture_output=True)
            time.sleep(2)
    except Exception as e:
        print(f"终止进程时出错: {e}")
    
    # 启动新的worker进程
    try:
        print("启动新的Huey worker...")
        worker_cmd = [
            sys.executable, '-m', 'huey.bin.huey_consumer', 
            'app.huey', '--workers=1'
        ]
        
        # 在后台启动worker
        subprocess.Popen(worker_cmd, 
                        cwd=os.path.dirname(os.path.abspath(__file__)),
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)
        
        print("Huey worker已重启！")
        print("现在可以尝试使用拆分标签功能了。")
        
    except Exception as e:
        print(f"启动worker时出错: {e}")
        print("请手动运行以下命令启动worker:")
        print("cd backend")
        print("python -m huey.bin.huey_consumer app.huey --workers=1")

if __name__ == '__main__':
    restart_worker() 