# API 编码规范（standard）

## 目标

- 保证工程对外接口长期保持 **RESTful、一致、可维护**。
- 让新增接口具备“可读性/可预测性/可测试性”，避免动词式 RPC。
- 统一接口的错误信息、状态码、分页与任务模型。

## 目录与职责

```mermaid
flowchart TD
  "前端（Vue）" --> "HTTP（/api/v1）"
  "HTTP（/api/v1）" --> "路由层（apps/api/app/api/v1/*）"
  "路由层（apps/api/app/api/v1/*）" --> "业务层（apps/api/app/services/*）"
  "业务层（apps/api/app/services/*）" --> "数据层（apps/api/app/models/* + db.session）"
  "路由层（apps/api/app/api/v1/*）" --> "任务层（apps/api/app/tasks/* + Huey）"
```

- **路由层**：只做参数解析/校验、调用服务、拼装响应；禁止堆业务逻辑。
- **业务层**：承载核心规则与复用逻辑（例如路径归一化、任务记录写入）。
- **任务层**：长耗时操作（扫描、批量改名、批处理），只接收结构化参数。

## RESTful 规范（强制）

### 1) URL 规则

- 只使用名词表达资源，禁止动词式路径（例如禁止 `/do-scan`、`/rename/file`）。
- 路径统一 **kebab-case**，集合资源使用复数（如 `tag-types`、`library-paths`）。
- 子资源用层级表达（如 `files/{id}/pages/{page}`、`files/{id}/cover`）。

### 2) 方法语义（强制）

- `GET` 必须无副作用：**禁止写库、禁止创建任务记录、禁止创建目录**。
- `POST` 用于创建资源/提交任务/触发一次性操作。
- `PUT` 用于替换更新（完整对象提交）。
- `PATCH` 用于局部更新（阅读进度、单文件改名等）。
- `DELETE` 用于删除资源或清理历史。

### 3) 状态码（强制）

- `200` 成功（查询/更新）
- `201` 成功创建
- `202` 已接受（异步任务已提交）
- `204` 成功但无返回体（删除/幂等写操作）
- `400/404/409/500` 按语义返回

## 返回与错误格式

### 1) 错误格式

统一：

```json
{ "error": "中文错误信息" }
```

### 2) 列表返回

- 对于分页列表（如 `files`、`tags`），必须返回 `total/page/pages` 或 `pagination` 结构。
- 对于不分页列表，应明确约定（例如 `tags` 支持 `per_page=0` 表示不分页）。

## 参数校验与安全

- 解析 JSON：统一用 `request.get_json(silent=True) or {}`。
- 校验数字：禁止接受 `true/false` 伪装整数（Python 中 `bool` 是 `int` 子类）。
- 校验文件名：只能接受 `basename`，禁止路径穿越（`..`、`/`、`\\`）。
- 禁止使用 `print` 输出调试信息；需要日志统一用 `loguru`，且内容使用中文。

## 任务（Task）规范

- 长耗时操作必须写入任务中心（`Task`），并返回：
  - `202` + `db_task_id`（数据库任务 ID）
  - 需要时返回 `task_id`（Huey 任务 ID）
- 取消任务只能通过更新任务资源完成：
  - `PATCH "/api/v1/tasks/{id}"` + `{ "status": "cancelled" }`
- 清理历史任务通过删除“任务历史”资源完成：
  - `DELETE "/api/v1/task-history"`

