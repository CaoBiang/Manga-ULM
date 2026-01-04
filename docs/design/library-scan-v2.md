# 图书馆扫描与封面缓存（V2 设计）

## 设计目的

- 扫描更快：避免“每次扫描都全量解压/解码”的高峰 I/O 与 CPU 开销。
- 数据更合理：允许同内容多份文件并存，同时支持“移动/重命名后保留阅读进度与标签”。
- 封面更稳定：封面与文件记录绑定，可重建、可分片，避免单目录堆积海量小文件。

## 整体流程

```mermaid
flowchart TD
  "开始扫描" --> "读取图书馆路径（LibraryPath）"
  "读取图书馆路径（LibraryPath）" --> "遍历目录发现压缩包（发现阶段）"
  "遍历目录发现压缩包（发现阶段）" --> "对比 size/mtime（增量判定）"
  "对比 size/mtime（增量判定）" --> "未变更：跳过重分析"
  "对比 size/mtime（增量判定）" --> "新增/变更：轻量分析"
  "新增/变更：轻量分析" --> "读取压缩包索引（页数）"
  "新增/变更：轻量分析" --> "可选：计算 SHA-256（内容识别）"
  "读取压缩包索引（页数）" --> "写入数据库（File）"
  "可选：计算 SHA-256（内容识别）" --> "写入数据库（File）"
  "写入数据库（File）" --> "批量生成封面（可配置）"
  "批量生成封面（可配置）" --> "扫描完成"
```

## 数据模型（关键点）

### File（文件记录）

- `library_path_id`：归属的图书馆路径（用于扫描时快速标记缺失/非缺失）。
- `file_path`：文件绝对路径（唯一）。
- `file_size`、`file_mtime`：用于增量扫描的“快速签名”。
- `total_pages`：页数（通过读取压缩包目录索引得到，不解压整本）。
- `content_sha256`：内容哈希（可空、可重复）。
  - 用于：移动/重命名识别、重复内容检测。
  - 由 `scan.hash.mode` 控制是否计算。
- `cover_updated_at`：封面最后生成时间（Unix 秒）。
  - 用于：封面 URL 版本号，配合强缓存避免“封面内容已变但 URL 不变”。

### 不再存储 spread_pages

跨页/宽图判定属于阅读体验层，更适合在前端基于图片真实宽高实时判断（与 `ui.reader.wide_ratio_threshold` 配合）。

## 增量扫描判定规则

- **未变更**：同一 `file_path` 下 `file_size` 与 `file_mtime` 都一致 ⇒ 跳过重分析。
- **新增/变更**：进入轻量分析（索引页数 + 可选 SHA-256）。
- **缺失标记同步（增量）**：不再“先全表标记缺失再回填”，改为按本次发现集合增量同步：
  - 数据库中 `is_missing=false` 但本次未发现 ⇒ 标记为 `is_missing=true`
  - 数据库中 `is_missing=true` 但本次发现到 ⇒ 恢复为 `is_missing=false`
- **移动/重命名识别（需要 hash_mode=full）**：
  - 新路径在数据库中不存在时，若在同 `library_path_id` 下找到**唯一**一条 `is_missing=true` 且 `content_sha256` 相同的记录 ⇒ 认为是“移动/重命名”，复用旧记录（保留阅读进度/标签/收藏等）。
  - 若匹配结果不唯一 ⇒ 视为新文件，避免误合并。

## 封面缓存设计

### 路径布局

- 基础目录：`instance/covers/`
- 文件路径：`instance/covers/<shard>/<file_id>.webp`
  - `file_id` 来自数据库 `File.id`
  - `shard` 由 `cover.cache.shard_count` 决定（取模分片）

### 访问接口

- `GET /api/v1/files/<id>/cover?v=<cover_updated_at 或 file_mtime>`
  - URL 带 `v` 版本号，可安全开启强缓存：封面重新生成会自动换 URL。

### 重建策略

- 删除 `instance/covers/` 后重新扫描即可重建封面缓存。
- 若希望“未变更文件也补全缺失封面”，开启 `scan.cover.regenerate_missing=1`。

## 关键设置项

> 所有设置均为后端 Key-Value（见：`/api/v1/settings`）。

- `scan.max_workers`：并行扫描工作数（建议=CPU 核心数）。
- `scan.hash.mode`：内容哈希模式
  - `full`：计算 SHA-256（较慢，可识别移动/重复）
  - `off`：不计算（更快，但无法识别移动/重复）
- `scan.cancel_check.interval_ms`：扫描过程取消检测间隔（毫秒，越小响应越快但数据库读更频繁）。
- `scan.cover.mode`：封面生成模式
  - `scan`：扫描时生成/刷新封面
  - `off`：不自动生成（缺失时显示占位图）
- `scan.cover.regenerate_missing`：是否补全缺失封面（`0/1`）
- `scan.cover.*`：封面尺寸与质量控制（宽度、目标 KB、质量起始/最小/步长）
- `cover.cache.shard_count`：封面缓存分片数量（修改后需要重建封面缓存）

## 失败与恢复

- **索引读取失败**：仅影响单文件，其他文件继续扫描；前端会收到 `scan_error`。
- **封面生成失败**：不阻塞入库；前端封面显示占位图，可通过重新扫描重建。
- **取消任务**：任务状态会标记为 `cancelled`，扫描会尽快结束（可能需要等待当前并发任务收尾）。
