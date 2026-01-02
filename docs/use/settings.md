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

## 常见问题

- “重置”做了什么：删除数据库中的覆盖项，回退到后端默认值。
- 修改后何时生效：大多数设置会立即生效；部分页面可能需要重新进入以触发重新渲染。
