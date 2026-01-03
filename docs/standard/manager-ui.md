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
- 全局样式在 `frontend/src/assets/main.css` 中以 `body.app-is-manager` 为作用域，统一覆盖 AntDesign 默认外观。

```mermaid
flowchart TD
  "设置页面（显示设置）" --> "写入 ui.manager.ui.*"
  "写入 ui.manager.ui.*" --> "后端 Config 表持久化"
  "应用启动" --> "读取 /api/v1/settings"
  "读取 /api/v1/settings" --> "Pinia: appSettingsStore"
  "Pinia: appSettingsStore" --> "App.vue 注入 body CSS 变量"
  "body CSS 变量" --> "GlassSurface / GlassPage"
  "body CSS 变量" --> "AntDesign 浮层（Modal/Popover/Dropdown）"
```

## 组件清单

### GlassPage

- 路径：`frontend/src/components/glass/ui/GlassPage.vue`
- 用途：统一页面内边距与顶部标题区（可选）。
- 用法：
  - 只需要统一边距时：不传 `title`/`subtitle`。
  - 需要在内容区再展示标题时：传入 `title`/`subtitle`，并用 `#extra` 放右侧操作区。

### GlassSurface

- 路径：`frontend/src/components/glass/ui/GlassSurface.vue`
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

