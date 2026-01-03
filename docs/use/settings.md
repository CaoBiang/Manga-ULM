# 设置（使用）

## 这是什么

设置用于控制应用的“默认行为与显示效果”。所有设置都以 Key-Value 的形式保存到后端数据库，保证重启后仍然生效。

## 基本流程

```mermaid
flowchart TD
  "用户进入设置页面" --> "读取 /api/v1/settings"
  "用户点击保存" --> "写入 /api/v1/settings/<key>"
  "用户点击重置" --> "删除 /api/v1/settings/<key>"
  "写入 /api/v1/settings/<key>" --> "前端刷新设置缓存"
  "删除 /api/v1/settings/<key>" --> "前端刷新设置缓存"
```

## 阅读器外观相关（新增）

阅读器页面的按钮与输入框使用“灰黑白 + 半透明 + 磨砂”的自定义风格，可在“阅读器设置”中调整：

- `ui.reader.toolbar.background_opacity`：工具条与返回按钮底色透明度（`0.08–0.8`）。
- `ui.reader.ui.blur_enabled`：是否启用磨砂模糊（`0/1`）。
- `ui.reader.ui.blur_radius_px`：模糊半径（像素，`0–30`）。
- `ui.reader.ui.control_bg_opacity`：控件背景透明度（`0.12–0.7`）。
- `ui.reader.ui.control_border_opacity`：控件边框透明度（`0.06–0.4`）。

示例：关闭模糊（更省性能）

- Key：`ui.reader.ui.blur_enabled`
- Value：`0`

## 漫画管理器外观相关（新增）

漫画管理器（非阅读器）页面统一使用毛玻璃风格，可在“设置” -> “显示设置”中调整：

- `ui.manager.ui.blur_enabled`：是否启用磨砂模糊（`0/1`）。
- `ui.manager.ui.blur_radius_px`：模糊半径（像素，`0–30`）。
- `ui.manager.ui.surface_bg_opacity`：容器背景透明度（`0.35–0.95`）。
- `ui.manager.ui.surface_border_opacity`：容器边框透明度（`0.06–0.45`）。
- `ui.manager.ui.control_bg_opacity`：控件背景透明度（`0.18–0.9`）。
- `ui.manager.ui.control_border_opacity`：控件边框透明度（`0.06–0.6`）。

示例：关闭管理器模糊（更省性能）

- Key：`ui.manager.ui.blur_enabled`
- Value：`0`

## 阅读器点击区域（新增）

阅读器支持“点击区域”配置，用于控制点击画面左/中/右区域时执行的动作，并可调整每个区域的响应范围。

- 设置页面：`/settings/reader`（阅读器设置 -> 点击区域）
- 对应 Key：`ui.reader.tap_zones`

Value 为 JSON 字符串，示例（默认）：

- `{"version":1,"boundaries":{"left":0.3,"right":0.7},"actions":{"left":"prev_page","middle":"toggle_toolbar","right":"next_page"}}`

字段说明：

- `boundaries.left`：左侧区域宽度（0–1）。
- `boundaries.right`：右侧区域起点（0–1）。
- `actions.left/middle/right`：区域动作（如 `prev_page`、`next_page`、`toggle_toolbar`、`expand_toolbar`、`collapse_toolbar`、`none`）。

## 常见问题

- “重置”做了什么：删除数据库中的覆盖项，回退到后端默认值。
- 修改后何时生效：大多数设置会立即生效；部分页面可能需要重新进入以触发重新渲染。
