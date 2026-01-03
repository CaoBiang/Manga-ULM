# 阅读器控件复用规范（标准）

## 目标

- 阅读器内的按钮、输入框不直接复用 AntDesign 外观，保持“灰黑白 + 半透明 + 磨砂”的一致性。
- 控件样式由 CSS 变量驱动，并暴露为设置项，避免写死。

## 组件清单

### ReaderButton

- 路径：`apps/web/src/components/reader/ui/ReaderButton.vue`
- 用途：阅读器工具条、面板操作、表格内动作按钮等。

推荐用法（图标按钮）：

- `shape="circle"` + `aria-label` 必填（无文本时提升可访问性）。
- `variant="primary"`：强调/选中状态。
- `variant="danger"`：删除等危险操作。
- `appearance="embedded"`：仅用于“容器已有明确底色/边框”的轻量内嵌按钮（不想重复绘制磨砂底与阴影时）。
- 若希望按钮外观与“返回按钮”一致（半透明 + 磨砂 + 边框 + 阴影），请使用默认 `appearance`（不传即可），并在父容器统一覆盖 `--reader-ui-control-*` 变量。

### ReaderInput

- 路径：`apps/web/src/components/reader/ui/ReaderInput.vue`
- 用途：阅读器内的简单文本输入（如书签备注）。

行为约定：

- 使用 `v-model` 绑定（对应 `modelValue`）。
- 回车提交：监听 `@pressEnter`。
- 需要聚焦时：通过组件 `ref` 调用 `focus()`。

### ReaderToolbar（进度控件容器）

- 路径：`apps/web/src/pages/ReaderView.vue`
- 用途：阅读器底部进度控件（页码/总页数 + 展开后的滑块）所在容器。

约定：

- 进度控件容器的“毛玻璃底”应与“返回按钮”的毛玻璃底一致：底色、阴影统一复用 `--reader-toolbar-control-*` 与 `--reader-ui-control-backdrop-filter`，避免出现两套磨砂视觉。
- 进度控件容器仅在“收起态”允许悬浮变暗（用于提示可点击展开）；“展开态”不应因为鼠标悬浮而变暗，避免产生错误的可交互暗示。

## 样式变量（由阅读器页面注入）

阅读器页面应在根节点注入以下 CSS 变量，供控件统一取值：

- `--reader-ui-control-backdrop-filter`：例如 `"blur(12px)"` 或 `"none"`。
- `--reader-ui-control-bg`：按钮/输入框背景色（带透明度）。
- `--reader-ui-control-bg-hover`：悬停背景色。
- `--reader-ui-control-bg-active`：按下背景色。
- `--reader-ui-control-border`：边框颜色（带透明度）。
- `--reader-ui-control-border-hover`：悬停边框颜色。

```mermaid
flowchart TD
  "阅读器页面（ReaderView）" --> "注入 CSS 变量"
  "注入 CSS 变量" --> "ReaderButton"
  "注入 CSS 变量" --> "ReaderInput"
  "注入 CSS 变量" --> "ReaderToolbar（进度控件容器）"
```

## 对应设置项

- `ui.reader.toolbar.background_opacity`
- `ui.reader.ui.blur_enabled`
- `ui.reader.ui.blur_radius_px`
- `ui.reader.ui.control_bg_opacity`
- `ui.reader.ui.control_border_opacity`

## 点击区域（Tap Zones）

### ReaderTapZonesLayer

- 路径：`apps/web/src/components/reader/tapZones/ReaderTapZonesLayer.vue`
- 用途：覆盖在阅读器画面之上，将点击位置映射为左/中/右区域，并向上抛出动作事件。

约定：

- 不在组件内直接操作“翻页/展开工具条”等业务逻辑，而是由 `ReaderView` 统一处理（便于后续扩展更多动作）。
- 组件仅负责“命中区域计算”与“事件分发”，避免耦合设置存储。

### ReaderTapZonesConfigurator

- 路径：`apps/web/src/components/reader/tapZones/ReaderTapZonesConfigurator.vue`
- 用途：可视化配置点击区域的动作与范围（拖动分割线），并保存到设置中。

样式约定：

- 复用 `--reader-ui-control-*` 与 `--reader-ui-control-backdrop-filter`，保持“灰黑白 + 半透明 + 磨砂”的一致性。

```mermaid
flowchart TD
  "阅读器页面（ReaderView）" --> "ReaderTapZonesLayer"
  "ReaderTapZonesLayer" --> "触发动作（上一页/下一页/展开收起工具条）"
  "工具条展开态" --> "点击区域配置按钮"
  "点击区域配置按钮" --> "ReaderTapZonesConfigurator"
  "ReaderTapZonesConfigurator" --> "写入设置 ui.reader.tap_zones"
```
