# 漫画管理器毛玻璃控件复用规范（标准）

## 目标

- 漫画管理器（非阅读器）页面统一采用“毛玻璃 + 半透明 + 低对比度”的视觉语言，与阅读器保持风格一致。
- 尽量不在业务组件内写死颜色与模糊参数，统一由“设置项 -> CSS 变量”驱动。
- 组件优先复用：页面结构复用 `GlassPage`，容器复用 `GlassSurface`，减少重复布局代码。

## 核心思路

- 管理器外观设置保存为 Key-Value：`ui.manager.ui.*`。
- 前端启动时加载设置到 Pinia（`appSettingsStore`）。
- `App.vue` 在“非全屏路由（管理器）”时，把变量注入到 `body`：
  - 这样弹窗/下拉/气泡等 Portal 浮层也能继承同一套毛玻璃变量。
- 侧边栏收起时，`a-menu` 的二级菜单会以 Portal 形式挂载到 `body`（`.ant-menu-submenu-popup`），其背景也必须纳入毛玻璃 surface 体系（避免“完全透明”）。
- 全局样式在 `apps/web/src/assets/main.css` 中以 `body.app-is-manager` 为作用域，统一覆盖 AntDesign 默认外观。
- 覆盖范围包含“细节控件”：按钮（含图标按钮/文本按钮/危险按钮）、Badge、Tag 等，保证列表卡片里的红心按钮等交互点也统一为毛玻璃。
- Badge 颜色支持多种：通过在 `a-badge` 上添加类名切换，例如 `manager-badge--blue`、`manager-badge--green`、`manager-badge--orange` 等。
- 管理器端的按钮/搜索框会大量使用 `@ant-design/icons-vue` 图标组件，其默认的 `.anticon { vertical-align: -0.125em; }` 会导致“图标偏下”。因此必须在管理器作用域内，对按钮图标容器与输入框前后缀做统一的垂直居中处理（见下文“图标对齐”）。

```mermaid
flowchart TD
  "设置页面（显示设置）" --> "写入 ui.manager.ui.*"
  "写入 ui.manager.ui.*" --> "后端 Config 表持久化"
  "应用启动" --> "读取 /api/v1/settings"
  "读取 /api/v1/settings" --> "Pinia: appSettingsStore"
  "Pinia: appSettingsStore" --> "App.vue 注入 body CSS 变量"
  "body CSS 变量" --> "GlassSurface / GlassPage"
  "body CSS 变量" --> "AntDesign 浮层（Modal/Popover/Dropdown/MenuPopup）"
```

## 任务管理器（历史任务）

### 目标

- 任务管理器不仅展示“正在运行的任务”，还要保留一段时间的“历史任务”，让用户能回看结果、定位失败原因。
- 用户不需要一直停留在任务管理器页面：侧边栏徽标与通知负责“提醒”，任务管理器页面负责“回看与管理”。

### 页面结构（设置 -> 任务管理器）

- 上半部分：任务设置（`TaskSettings`）
  - 控制“历史任务展示数量 / 保留天数 / 通知开关 / 侧边栏徽标开关”。
- 下半部分：任务列表（`TaskManager`）
  - `活跃任务`：pending/running，可取消。
  - `历史任务`：completed/failed/cancelled，保留结果与错误信息。

### 数据流与可感知设计

- 数据来源：后端 `Task` 表（Huey 任务 + 状态持久化）。
- 前端通过轮询 `/api/v1/tasks?limit=...` 拉取“最近任务”，拆分为活跃/历史两类展示。
- “可感知”来源：
  - 侧边栏“任务管理器”显示徽标：活跃任务显示数量；出现新任务结果时显示数量并用颜色区分失败/普通。
  - 任务结果通知：失败默认提醒；完成提醒可选（均可在设置中关闭）。

```mermaid
flowchart TD
  "任务状态变化（pending/running/completed/failed/cancelled）" --> "后端 Task 表记录"
  "后端 Task 表记录" --> "前端轮询 /api/v1/tasks?limit=..."
  "前端轮询 /api/v1/tasks?limit=..." --> "Pinia: libraryStore.recentTasks"
  "Pinia: libraryStore.recentTasks" --> "TaskManager：活跃/历史列表"
  "Pinia: libraryStore.recentTasks" --> "侧边栏徽标（App.vue）"
  "Pinia: libraryStore.recentTasks" --> "通知（App.vue）"
```

### 相关设置 Key（后端 Config 表）

- `ui.tasks.history.limit`：历史任务展示数量（同时影响“最近任务”拉取数量）。
- `ui.tasks.history.retention_days`：历史任务清理保留天数（0 表示清理全部历史任务）。
- `ui.tasks.notify.on_complete`：是否提示“任务完成”。
- `ui.tasks.notify.on_fail`：是否提示“任务失败”。
- `ui.tasks.badge.enabled`：侧边栏是否显示任务徽标。

### 常见任务类型（task_type）

- `scan`：图书馆扫描（含封面生成/增量识别）。
- `rename`：批量重命名、单文件重命名、标签驱动的重命名。
- `delete`：标签驱动的“从文件名删除标签”。
- `split`：拆分标签（含文件名变更）。
- `merge`：合并标签（合并文件关联与别名）。
- `tag_scan`：扫描文件名中的“未定义标签”。
- `bulk_tags`：批量修改文件的标签（数据库侧）。
- `backup`：创建备份、还原备份（还原后通常需要重启应用生效）。
- `duplicates`：查找重复文件（基于 `content_sha256`）。
- `missing_cleanup`：清理“缺失文件记录”（数据库侧）。
- `integrity`：完整性检查（缺失/可能损坏）。

## 组件清单

### GlassPage

- 路径：`apps/web/src/components/glass/ui/GlassPage.vue`
- 用途：统一页面内边距与顶部标题区（可选）。
- 用法：
  - 默认用法（推荐）：只负责统一边距，不传 `title`/`subtitle`，避免页面内容区重复出现标题。
  - 需要在内容区再展示“模块级标题”时：传入 `title`/`subtitle`，并用 `#extra` 放右侧操作区（注意：这里不用于“页面标题”）。

### 页面标题规范（必须）

- 页面标题只在全局 `PageHeader` 中展示一次，不显示“应用名/页面名”的面包屑。
- 页面标题来源统一为路由 `meta.titleKey`（见：`apps/web/src/router/index.js`），页面内容区不要再额外渲染同级标题（例如 `GlassPage` 的 `title`）。
- 页面内容区如果需要展示“上下文信息”（例如文件名），应使用文件名/路径等作为内容，不要重复页面标题文案（例如“编辑文件详情”）。
- 同一页面的同一核心动作（例如“保存更改”）只保留一个入口，避免重复按钮造成困扰。
- 多模块页面用 `a-space direction="vertical" size="large"` 统一模块间距，保证与设置页一致。

### GlassSurface

- 路径：`apps/web/src/components/glass/ui/GlassSurface.vue`
- 用途：统一“卡片/面板/容器”的毛玻璃底、边框与阴影。
- 关键参数：
  - `variant="panel|card|plain"`：面板/小卡片/透明容器。
  - `padding="none|sm|md|lg"`：统一内边距。
  - `title/subtitle`：容器标题区（可选）。

## 样式变量（由 App.vue 注入到 body）

- `--manager-ui-blur-enabled`：是否启用磨砂（`0/1`）。
- `--manager-ui-blur-radius-px`：模糊半径（像素，`0–30`）。
- `--manager-ui-surface-bg-opacity`：容器背景透明度（`0.35–0.95`）。
- `--manager-ui-surface-border-opacity`：容器边框透明度（`0.06–0.45`）。
- `--manager-ui-control-bg-opacity`：控件背景透明度（`0.18–0.9`）。
- `--manager-ui-control-border-opacity`：控件边框透明度（`0.06–0.6`）。

说明：

- 派生变量（如 `--manager-ui-backdrop-filter`、`--manager-ui-surface-bg`）在 CSS 中计算，业务组件不应自行拼接。
- 所有 AntDesign 覆盖样式必须写在 `body.app-is-manager` 作用域内，避免影响阅读器全屏路由。

## 侧边栏二级菜单弹层（必须）

现象：

- 侧边栏处于“收起状态”时，点击带子菜单的条目，会弹出二级菜单；如果弹层背景透明，会出现“文字浮在页面上”的问题。

根因：

- 管理器端为了让菜单融入侧边栏毛玻璃容器，会把 `.ant-menu` 背景设为透明。
- 但收起状态下的二级菜单不是渲染在侧边栏内，而是 Portal 到 `body` 的 `.ant-menu-submenu-popup`，如果弹层容器没有 surface 背景，就会变成“完全透明”。

解决方案（统一在全局样式中处理）：

- 在 `body.app-is-manager` 作用域内，为 `.ant-menu-submenu-popup` 应用与 `Modal/Popover/Dropdown` 相同的 surface 毛玻璃样式（背景/边框/阴影/模糊）。
- 对应代码位置：`apps/web/src/assets/main.css`。

## 图标对齐（必须）

现象：

- 在管理器端，`a-button` 的 `#icon` 插槽、`a-input-search` 的搜索按钮/后缀图标，可能出现“图标不居中、整体偏下”。

根因：

- `@ant-design/icons-vue` 注入的全局样式中，`.anticon` 默认带 `vertical-align: -0.125em;`，其设计目标是“对齐文字基线”，但在管理器端的“固定高度按钮/输入框”中会造成视觉偏移。

解决方案（统一在全局样式中处理）：

- 仅在 `body.app-is-manager` 作用域内：
  - 将 `.ant-btn` 及其 `.ant-btn-icon` 调整为 `inline-flex` 并 `align-items: center`。
  - 在按钮图标与输入框前后缀内部，把 `.anticon` 的 `vertical-align` 重置为 `0`。
- 对应代码位置：`apps/web/src/assets/main.css`。
