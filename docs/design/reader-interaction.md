# 阅读器点击区域（设计）

## 设计目的

- 让用户可视化配置“点击区域”的用途（上一页、下一页、展开/收起进度工具条等）。
- 支持将画面按横向/竖向拆分为多个区域（网格），并可拖动分割线调整每个区域的响应范围。
- 支持通过“横向拆分/竖向拆分、横向合并/竖向合并”快速增减区域数量。
- 将配置持久化到后端设置中，重启后仍生效。

## 核心思路

- 后端以 Key-Value 形式保存设置：`ui.reader.tap_zones`（值为 JSON 字符串）。
- 前端在启动时加载设置到 Zustand（`useAppSettingsStore.readerTapZones`），阅读器页面直接消费该配置。
- 阅读器页面使用“覆盖层”接管点击命中，将点击映射为指定区域并触发动作。
- 设置入口统一收敛到“设置” -> “阅读器设置” -> “点击区域”，不再单独拆分“阅读器交互”页面。

## 数据流

```mermaid
flowchart TD
  "用户在阅读器中打开配置界面" --> "可视化编辑（拖动分割线/选择动作）"
  "可视化编辑（拖动分割线/选择动作）" --> "写入 ui.reader.tap_zones"
  "写入 ui.reader.tap_zones" --> "后端 Config 表持久化"
  "应用启动/刷新设置" --> "读取 /api/v1/settings"
  "读取 /api/v1/settings" --> "Zustand: useAppSettingsStore.readerTapZones"
  "Zustand: useAppSettingsStore.readerTapZones" --> "ReaderView 点击区域覆盖层"
  "ReaderView 点击区域覆盖层" --> "翻页/展开收起工具条等动作"
```

## 默认行为（开箱即用）

- 默认 3 段：左侧区域上一页 / 中间区域切换进度工具条（展开/收起）/ 右侧区域下一页。
- 用户可根据习惯横向/竖向拆分为更多区域（例如 3×3：中间切换工具条，四角/四边自定义为翻页或无动作）。

默认分割比例：`30% / 40% / 30%`（对应 `xSplits=[0.3,0.7]`、`ySplits=[]`）。

## 相关实现

- 后端默认设置：`apps/api/app/services/settings_service.py`
- 前端设置仓库：`apps/web/src/store/appSettings.ts`（readerTapZones）
- 阅读器入口：`apps/web/src/pages/ReaderView.tsx`（实际实现位于 `apps/web/src/pages/reader/ReaderViewPage.tsx`）
- 覆盖层与配置界面：`apps/web/src/components/reader/tapZones/`
- 设置入口：`apps/web/src/pages/settings/SettingsReaderView.tsx`
