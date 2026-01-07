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

## 扫描与封面（新增）

“设置” -> “图书馆设置”中提供扫描与封面相关选项，对应的 Key 如下：

### 扫描并发

- `scan.max_workers`：并行扫描工作数（建议=CPU 核心数）。

示例：将并行扫描工作数设为 8

- Key：`scan.max_workers`
- Value：`8`

### 内容哈希（用于移动/重复识别）

- `scan.hash.mode`：内容哈希模式
  - `full`：计算 SHA-256（较慢，可识别移动/重复）
  - `off`：关闭哈希（更快，但无法识别移动/重复）

示例：关闭内容哈希（更快）

- Key：`scan.hash.mode`
- Value：`off`

### 封面生成与缓存

- `scan.cover.mode`：封面生成模式
  - `scan`：扫描时生成/刷新封面
  - `off`：不自动生成（缺失时显示占位图）
- `scan.cover.regenerate_missing`：是否补全缺失封面（`0/1`）
  - 当你手动删除了 `instance/covers` 时，开启该选项并重新扫描即可重建封面缓存。
- `cover.cache.shard_count`：封面缓存分片数量（修改后需要重建封面缓存）

### 封面质量与尺寸

- `scan.cover.max_width`：封面最大宽度（像素）。
- `scan.cover.target_kb`：封面目标大小（KB）。
- `scan.cover.quality_start`：起始质量（1–100）。
- `scan.cover.quality_min`：最小质量（1–100）。
- `scan.cover.quality_step`：质量下降步长（1–50）。

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

## 阅读器分辨率（新增）

用于在高分辨率漫画上降低加载与渲染压力，并可作为缓解摩尔纹的手段。阅读器在请求页图时会携带缩放参数，让后端按需缩放并重新编码。

- `ui.reader.image.max_side_px`：页面最长边像素（`0` 表示原图）。
- `ui.reader.image.max_side_presets`：工具条快捷预设（JSON 数组，必须包含 `0` 表示原图）。
- `ui.reader.image.render.format`：缩放输出格式（`webp/jpeg/png/auto`）。
- `ui.reader.image.render.quality`：输出质量（`1–100`，仅对 `webp/jpeg` 生效）。
- `ui.reader.image.render.resample`：重采样算法（`nearest/bilinear/bicubic/lanczos`）。
- `ui.reader.image.render.optimize`：是否启用编码优化（`0/1`，开启后体积更小但更慢）。
- `ui.reader.image.render.webp_method`：WebP 编码方法（`0–6`，数值越大越清晰但更慢）。
- `ui.reader.image.preload.concurrency`：预加载并发数（`1–6`，数值越大预处理越快但更吃 CPU）。
- `ui.reader.image.cache.enabled`：是否启用页图缓存（`0/1`）。
- `ui.reader.image.cache.max_age_s`：页图缓存最大时长（秒）。
- `ui.reader.image.cache.immutable`：是否标记为 immutable（`0/1`，用于提升浏览器缓存命中）。

注意：当 `ui.reader.image.max_side_px=0` 时，后端直接返回原图，`format/quality/resample` 不生效。

示例：将阅读器分辨率限制为 1600px，并配置工具条预设

- Key：`ui.reader.image.max_side_px`
- Value：`1600`

- Key：`ui.reader.image.max_side_presets`
- Value：`[0,1200,1600,2000]`

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
