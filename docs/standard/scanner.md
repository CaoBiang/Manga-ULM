# 扫描与封面模块规范（standard）

## 目标

- 扫描逻辑可维护：职责清晰、可扩展、可测试。
- 性能稳定：避免不必要的全量解压/解码与重复读文件。
- 并发安全：并发阶段不触碰数据库 Session，避免线程安全问题。

## 模块边界

```mermaid
flowchart TD
  "Huey 任务编排" --> "扫描任务（tasks/scanner.py）"
  "扫描任务（tasks/scanner.py）" --> "设置读取（services/settings_service.py）"
  "扫描任务（tasks/scanner.py）" --> "归档索引与页读取（infrastructure/archive_reader.py）"
  "扫描任务（tasks/scanner.py）" --> "封面生成（services/cover_service.py）"
  "扫描任务（tasks/scanner.py）" --> "数据库写入（models/* + db.session）"
```

## 并发与数据库（硬性规则）

- **线程池/并发函数不得触碰 `db.session`**。
  - 原因：SQLAlchemy Session 非线程安全，容易导致随机崩溃/数据错乱。
  - 正确做法：并发阶段只做“纯计算/纯 I/O”，返回结构化结果；数据库写入统一在主线程完成。

## 路径处理规范

- 扫描与入库必须对路径做归一化：
  - `os.path.normcase(os.path.abspath(os.path.normpath(path)))`
- Windows（映射网络盘符）必须优先解析为 UNC（例如 `V:\...` -> `\\server\share\...`），避免后台任务/不同权限上下文看不到盘符导致“扫描结果恒为 0”。
- 数据库中 `LibraryPath.path` 与 `File.file_path` 统一存储归一化后的绝对路径。
- 当图书馆路径不可访问/不是目录时：扫描任务必须直接失败并返回明确错误，禁止以“扫描完成但为 0”误导用户。

## 封面缓存规范

- 封面文件命名使用 `File.id`，避免依赖内容哈希或路径哈希。
- 必须使用原子写入（临时文件 + `os.replace`），避免中断/并发导致封面损坏。
- 允许强缓存：封面 URL 必须带版本参数（例如 `v=cover_updated_at`，或退化为 `v=file_mtime`）。

## 设置项规范

- 新增影响行为的参数必须落到设置（Key-Value），并在设置页可配置。
- 扫描相关设置建议以 `scan.*`、封面缓存相关建议以 `cover.*` 前缀归类。

当前关键 Key（示例）：

- `scan.max_workers`
- `scan.hash.mode`
- `scan.cancel_check.interval_ms`
- `scan.cover.mode`
- `scan.cover.regenerate_missing`
- `scan.cover.*`
- `cover.cache.shard_count`

## 扩展建议

- 若后续引入“快速哈希/抽样哈希”，建议新增 `scan.hash.mode=quick`，并在文档与 UI 中说明：
  - 用途：加速移动识别（近似）
  - 风险：理论上存在碰撞概率
