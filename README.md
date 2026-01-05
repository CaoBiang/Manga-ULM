# Manga-ULM（本地漫画管理器 + 阅读器）

本项目是一个本地部署的漫画管理器与漫画阅读器，采用：
- 后端：Python + Flask（含 Huey 异步任务）
- 前端：React 19 + Ant Design v6 + React Router + Zustand + i18n + Vite

## 目录结构（已优化）

```
apps/
  api/              # Flask API（含任务队列）
  web/              # React 前端（管理器与阅读器 UI）
configs/            # Nginx 等示例配置
docs/               # 设计/使用/规范文档
instance/           # 运行时数据（数据库、缓存、备份、日志等）
start.bat           # Windows 一键启动（开发）
```

说明：
- `instance/` 是唯一运行时目录：SQLite 数据库、Huey 持久化、封面缓存、备份等都在这里。
- 旧的 `backend/`、`frontend/` 目录如果仍残留，多半是因为 Windows 占用锁（可在关闭相关进程后手动删除）。

## Node 版本要求（前端）

- `apps/web` 当前使用 Vite 7，要求 Node 满足 `^20.19.0 || >=22.12.0`。

## 快速开始（开发模式）

### 1) 后端

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r .\apps\api\requirements.txt
```

初始化/升级数据库（首次需要）：

- 数据库会在启动时自动初始化。
- 若你之前运行过旧版本，可能需要删除 `instance/manga_manager*.db` 与 `instance/huey.db` 后重启（当前阶段不兼容旧数据）。

启动（两条命令建议分两个窗口）：
```powershell
cd apps\api
huey_consumer main.huey
```
```powershell
cd apps\api
python serve.py
```

### 2) 前端

```powershell
cd apps\web
npm install
npm run dev
```

访问：
- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:5000`

### 3) 一键启动（Windows）

直接运行根目录的 `start.bat`。

## 文档

- 管理器 UI 规范：`docs/standard/manager-ui.md`
- 阅读器 UI 规范：`docs/standard/reader-ui.md`
- RESTful API 设计：`docs/design/restful-api.md`
- API 编码规范：`docs/standard/api.md`
- 前端历史迁移说明：`docs/design/frontend-migration-react.md`
- 阅读器使用说明：`docs/use/reader.md`
- 性能优化说明：`docs/design/performance.md`
- 图书馆扫描与封面缓存（V2 设计）：`docs/design/library-scan-v2.md`
- 扫描与封面模块规范：`docs/standard/scanner.md`
