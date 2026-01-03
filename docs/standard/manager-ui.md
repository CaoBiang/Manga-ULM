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
