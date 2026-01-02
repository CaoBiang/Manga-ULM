# 设置

## 设计目的

- 将“通用 / 图书馆 / 显示 / 标签 / 任务”拆分为独立页面，侧边栏结构清晰可扩展。
- 将“用户可感知的配置项”统一落到后端设置表，并在设置页面中可视化编辑，保证开箱即用。
- 图书馆显示、扫描、阅读器等配置可自定义并持久化保存（网格列数、卡片字段、扫描并发、阅读预加载等）。
  - 其中“卡片字段”包含“阅读状态标签”（未读/阅读中/已完成）的显示开关。

## 整体设计

```mermaid
flowchart TD
  "用户点击侧边栏设置" --> "进入具体设置页面"
  "进入具体设置页面" --> "读取 /api/v1/settings"
  "用户点击保存" --> "写入 /api/v1/settings/<key>"
  "用户点击重置" --> "删除 /api/v1/settings/<key>"
  "写入 /api/v1/settings/<key>" --> "前端刷新设置缓存"
  "删除 /api/v1/settings/<key>" --> "前端刷新设置缓存"
  "前端刷新设置缓存" --> "图书馆/喜欢列表按设置渲染"
```

## 页面结构

- 通用设置：语言（`/settings/general`）
- 图书馆设置：路径管理、扫描相关、浏览设置、重命名模板（`/settings/library`）
- 显示设置：图书馆显示（`/settings/display`）
- 阅读器设置：预加载、分栏默认、宽图判定等（`/settings/reader`）
- 标签管理：标签类型、标签维护（`/settings/tag-management`）
- 任务管理：查看/取消活跃任务（`/settings/tasks`）
- 高级设置：通用 Key-Value 编辑器（`/settings/advanced`）

## 模块介绍

- 后端
  - `backend/app/services/settings_service.py`：统一管理默认值、类型化读取与写入逻辑。
  - `backend/app/api/settings.py`：提供通用 Key-Value 设置读写接口（包含重置/回退默认值）。
  - 默认值键名（节选）
    - `ui.language`：界面语言（`zh/en`）
    - `ui.library.view_mode`：图书馆默认视图模式（`grid/list`）
    - `ui.library.pagination.per_page`：图书馆默认每页数量（整数）
    - `ui.library.lazy_load.root_margin_px`：懒加载预取距离（像素）
    - `ui.reader.preload_ahead`：阅读器预加载后续页数（整数）
    - `ui.reader.split_view.default_enabled`：阅读器默认开启分栏（`0/1`）
    - `ui.reader.wide_ratio_threshold`：宽图判定阈值（宽/高，浮点数）
    - `ui.reader.toolbar.animation_ms`：阅读器底部工具条展开/收起动画时长（毫秒，整数）
    - `ui.reader.toolbar.background_opacity`：阅读器底部工具条背景透明度（0.4-0.9，浮点数）
    - `rename.filename_template`：批量重命名模板（字符串）
    - `scan.max_workers`：扫描并发进程数（整数）
    - `scan.spread.ratio`：跨页判定比例（浮点数）
    - `scan.cover.max_width`：封面最大宽度（像素）
    - `scan.cover.target_kb`：封面大小上限（KB）
    - `scan.cover.quality_start`：封面初始质量（1-100）
    - `scan.cover.quality_min`：封面最小质量（1-100）
    - `scan.cover.quality_step`：封面质量递减步长（整数）
    - `reader.stream.chunk_kb`：阅读按页流式分块大小（KB）
    - `ui.library.grid.columns`：网格列数（JSON 字符串）
    - `ui.library.card.fields`：卡片字段（JSON 字符串）
    - `ui.library.card.author_tag_type_id`：作者标签类型（字符串）
- 前端
  - `frontend/src/store/uiSettings.js`：统一加载与保存 UI 设置，并提供默认值兜底。
  - `frontend/src/store/appSettings.js`：统一加载与保存应用级设置（语言、阅读器、扫描、浏览、重命名等）。
  - `frontend/src/components/LibraryDisplaySettings.vue`：图书馆显示设置表单。
  - `frontend/src/components/LibraryBrowseSettings.vue`：图书馆浏览设置（默认视图/分页/预取距离）。
  - `frontend/src/components/RenameTemplateSettings.vue`：批量重命名模板设置。
  - `frontend/src/components/ReaderSettings.vue`：阅读器设置。
  - `frontend/src/views/SettingsAdvancedView.vue`：高级设置 Key-Value 编辑器。
  - `frontend/src/components/MangaGrid.vue`：按断点列数渲染网格布局。
  - `frontend/src/components/MangaCard.vue`：按字段设置控制卡片信息展示。

## 使用场景

- 屏幕较大时希望一行显示更多漫画。
- 只关心阅读进度与页数，希望隐藏文件大小/时间等信息。
- 需要在卡片上展示“作者”，且作者信息通过某一类标签维护。

## 使用方法

1. 打开“设置”页面，选择“显示设置”。
2. 在“图书馆网格列数”中分别调整不同屏幕宽度下的列数。
3. 在“卡片展示字段（网格/列表）”中勾选需要展示的字段。
4. 如需展示“作者”，在“作者标签类型”中选择你用于维护作者的标签类型。
5. 点击“保存”，图书馆与喜欢列表会按新设置刷新显示。

## 高级设置使用方法

1. 打开“设置”页面，选择“高级设置”。
2. 在列表中搜索需要修改的 Key，点击“编辑”。
3. 修改 value 并保存，配置会立即生效；点击“恢复默认”会删除覆盖项并回退默认值。

## 补充说明

- 除阅读器外，所有页面默认使用全宽内容区域（不再限制为居中固定宽度）。
