# 阅读器控件复用规范（标准）

## 目标

- 阅读器内的按钮、输入框不直接复用 AntDesign 外观，保持“灰黑白 + 半透明 + 磨砂”的一致性。
- 控件样式由 CSS 变量驱动，并暴露为设置项，避免写死。

## 迁移状态（重要）

- React 版本入口：`apps/web/src/pages/ReaderView.tsx`（实际实现位于 `apps/web/src/pages/reader/ReaderViewPage.tsx`）。
- 旧版 Vue 参考实现：`apps/web/_legacy/vue/src/pages/ReaderView.vue` 及其 `apps/web/_legacy/vue/src/components/reader/*`。

## 组件清单

### ReaderButton

- 目标路径：`apps/web/src/components/reader/ui/ReaderButton.tsx`
- 用途：阅读器工具条、面板操作、表格内动作按钮等。

推荐用法（图标按钮）：

- `shape="circle"` + `aria-label` 必填（无文本时提升可访问性）。
- `variant="primary"`：强调/选中状态。
- `variant="danger"`：删除等危险操作。
- `appearance="embedded"`：仅用于“容器已有明确底色/边框”的轻量内嵌按钮（不想重复绘制磨砂底与阴影时）。
- 若希望按钮外观与“返回按钮”一致（半透明 + 磨砂 + 边框 + 阴影），请使用默认 `appearance`（不传即可），并在父容器统一覆盖 `--reader-ui-control-*` 变量。

### ReaderInput

- 目标路径：`apps/web/src/components/reader/ui/ReaderInput.tsx`
- 用途：阅读器内的简单文本输入（如书签备注）。

行为约定：

- 使用受控属性绑定：`value` + `onChange`。
- 回车提交：暴露 `onPressEnter`（或在组件内部统一处理 `Enter` 键）。
- 需要聚焦时：通过组件 `ref` 调用 `focus()`。

### ReaderTable

- 目标路径：`apps/web/src/components/reader/ReaderTable.tsx`
- 用途：阅读器面板中的轻量表格展示（如书签列表、文件信息）。

约定：

- 表头必须使用 i18n，禁止写死字符串。
- 书签表格列顺序固定为：`页码` / `备注` / `操作`。
- 书签表格的“页码”列内容只显示数字（例如 `"22"`），不显示 `"第"` 等前缀。
- 书签表格的“操作”列固定包含：`编辑` / `删除` 两个圆形图标按钮。

### ReaderToolbar（进度控件容器）

- 路径：`apps/web/src/pages/reader/ReaderToolbar.tsx`
- 用途：阅读器底部进度控件（页码/总页数 + 展开后的滑块）所在容器。

约定：

- 进度控件容器的“毛玻璃底”应与“返回按钮”的毛玻璃底一致：底色、阴影统一复用 `--reader-toolbar-control-*` 与 `--reader-ui-control-backdrop-filter`，避免出现两套磨砂视觉。
- 进度控件容器仅在“收起态”允许悬浮变暗（用于提示可点击展开）；“展开态”不应因为鼠标悬浮而变暗，避免产生错误的可交互暗示。
- 翻页行为必须“纯粹”：只能改变 `currentPage`，禁止隐式触发工具条的 `收起/展开/面板` 状态变化（例如翻页自动关闭面板导致工具条突然缩小）。
- 若“文件信息”面板处于打开状态，翻页后必须自动刷新面板内容，且要避免并发请求导致旧页信息覆盖新页信息。

#### 三态与过渡动效（必须）

阅读器进度模块存在三种状态：

1. 状态 1（收起态）：仅显示页码/总页数。
2. 状态 2（展开态）：显示滑块 + 动作按钮。
3. 状态 3（面板态）：在展开态基础上，展开“书签/添加书签/文件信息”等面板内容。

动效目标：任何状态切换都必须“连续、无停顿、无跳变”，禁止出现视觉上的 `"3 -> 2 -> 1"` 卡顿感。

动效规范：

- `1 -> 2`：容器宽度与内边距平滑扩展；滑块从上方轻微位移 + 透明度进入；动作按钮组延迟极短进入（用于建立层级）。
- `2 -> 3`：面板以“向下展开 + 淡入”的方式出现，同时面板的分隔线、间距同步过渡（禁止只淡入内容而留下空白间距）。
- `3 -> 2`：面板以“向上收起 + 淡出”的方式消失，间距与分隔线同步收起（禁止过渡结束瞬间跳变）。
- `3 -> 1`：面板收起的同时，容器必须同步回到收起态；收起态容器宽度必须是“可动画的固定像素值”，禁止依赖 `fit-content`（面板退出时会重算导致二段收缩）。推荐通过测量页码指示器宽度并注入 `--reader-toolbar-collapsed-width-px` 实现。

```mermaid
stateDiagram-v2
  "状态 1（收起态）" --> "状态 2（展开态）": "点击进度条"
  "状态 2（展开态）" --> "状态 1（收起态）": "收起工具条"
  "状态 2（展开态）" --> "状态 3（面板态）": "打开书签/添加书签/编辑书签/文件信息"
  "状态 3（面板态）" --> "状态 2（展开态）": "关闭面板"
  "状态 3（面板态）" --> "状态 1（收起态）": "收起工具条"
  "状态 1（收起态）" --> "状态 1（收起态）": "翻页"
  "状态 2（展开态）" --> "状态 2（展开态）": "翻页"
  "状态 3（面板态）" --> "状态 3（面板态）": "翻页"
```

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
- `ui.reader.toolbar.keep_state_on_paging`
- `ui.reader.ui.blur_enabled`
- `ui.reader.ui.blur_radius_px`
- `ui.reader.ui.control_bg_opacity`
- `ui.reader.ui.control_border_opacity`

## 点击区域（Tap Zones）

### ReaderTapZonesLayer

- 目标路径：`apps/web/src/components/reader/tapZones/ReaderTapZonesLayer.tsx`
- 用途：覆盖在阅读器画面之上，将点击位置映射为左/中/右区域，并向上抛出动作事件。

约定：

- 不在组件内直接操作“翻页/展开工具条”等业务逻辑，而是由 `ReaderView` 统一处理（便于后续扩展更多动作）。
- 组件仅负责“命中区域计算”与“事件分发”，避免耦合设置存储。

### ReaderTapZonesConfigurator

- 目标路径：`apps/web/src/components/reader/tapZones/ReaderTapZonesConfigurator.tsx`
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
