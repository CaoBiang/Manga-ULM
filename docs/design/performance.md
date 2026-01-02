# 性能优化（设计）

## 设计目的

- 避免阅读时整本漫画解压到内存导致内存暴涨。
- 降低大量翻页或批量扫描时的重 I/O 与 CPU 消耗。
- 统一 Zip/Rar/7z 处理逻辑，确保“按需解压 + 缓存”行为一致。

## 整体设计

- 通过统一的归档读取抽象（`ArchiveReader`）建立“索引缓存”，并在读取页图时按需解压。
- 阅读接口按页流式输出，避免一次性读取/解压整包。
- 扫描与封面生成采用逐页解析策略，避免 `readall` 造成的峰值开销。

```mermaid
flowchart TD
  "前端请求某一页" --> "后端读取索引（缓存）"
  "后端读取索引（缓存）" --> "按需解压目标页（Zip/Rar/7z）"
  "按需解压目标页（Zip/Rar/7z）" --> "流式响应返回图片"
```

## 模块介绍

- `backend/app/infrastructure/archive_reader.py`：索引缓存、按页解压、流式输出、MIME 判定。
- `backend/app/api/files.py`：`/files/<id>/page/<page_num>` 以流式响应返回图片，降低峰值内存。
- `backend/app/tasks/scanner.py`：扫描与封面生成逐页处理，避免 7z 全量解压。

## 使用建议

- 阅读器前端按页拉取即可获得最佳体验，无需额外配置。
- 若需要重新生成封面：清理 `instance/covers` 后重新扫描。
