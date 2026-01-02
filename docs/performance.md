# 性能优化设计说明

## 设计目的
- 避免阅读时整本漫画解压到内存导致爆内存。
- 降低大量翻页或批量扫描时的重复 IO 与 CPU 消耗。
- 统一 Zip/Rar/7z 处理逻辑，保证按需解压与缓存一致性。

## 整体设计
- `archive_reader` 统一抽象压缩包访问，基于文件大小与修改时间缓存图片条目索引。
- 阅读接口改为按页流式输出：Zip/Rar 分块解压，7z 单页解压后分块发送。
- 扫描与封面生成逐页解析，不再使用 `readall`，跨页检测与封面候选都基于单页处理。
- 书库列表使用滚动懒加载，封面图片按视口触发请求，避免一次性加载导致前端卡顿。

```mermaid
flowchart TD
    "前端单页请求" --> "ArchiveReader 索引缓存"
    "ArchiveReader 索引缓存" --> "按页解压 (Zip/Rar/7z)"
    "按页解压 (Zip/Rar/7z)" --> "流式响应返回"
```

```mermaid
flowchart TD
    "进入书库页面" --> "拉取第 1 页元数据"
    "滚动接近底部" --> "拉取下一页元数据"
    "卡片进入视口" --> "请求封面图片"
```

## 模块介绍
- `backend/app/infrastructure/archive_reader.py`：提供索引缓存、按页解压、流式输出与 MIME 判定。
- `backend/app/api/files.py`：`/files/<id>/page/<page_num>` 使用流式响应返回图片，减少单次内存峰值。
- `backend/app/tasks/scanner.py`：扫描与封面生成按页处理，避免 7z 全量解压，日志改用 `loguru`。

## 使用场景
- 大量漫画快速浏览/翻页，内存保持稳定。
- 扫描包含大体积 7z/zip 的目录时，避免因一次性解压造成机器卡顿。
- 服务端运行在低内存设备（NAS、轻量云主机）时保持可用。

## 使用方法
- 正常启动后端与 Huey 即可，无需额外配置；依赖 `loguru`/`py7zr`/`rarfile` 已在 `requirements.txt` 声明。
- 若需要重新生成封面，删除 `instance/covers` 后重新扫描即可；索引缓存基于文件大小与修改时间自动失效。
- 前端请求保持单页拉取即可享受流式输出；无需调整现有 API 调用方式。
