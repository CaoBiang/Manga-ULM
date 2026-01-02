# 阅读器交互（设计）

## 设计目的

- 让用户可视化配置“点击画面左/中/右区域”的用途（上一页、下一页、展开/收起进度工具条等）。
- 让用户可视化调整每个区域的响应范围（拖动分割线即可）。
- 将配置持久化到后端设置中，重启后仍生效。

## 核心思路

- 后端以 Key-Value 形式保存设置：`ui.reader.tap_zones`（值为 JSON 字符串）。
- 前端在启动时加载设置到 Pinia（`appSettingsStore.readerTapZones`），阅读器页面直接消费该配置。
- 阅读器页面使用“覆盖层”接管点击命中，将点击映射为左/中/右区域并触发动作。

## 数据流

```mermaid
flowchart TD
  "用户在阅读器中打开配置界面" --> "可视化编辑（拖动分割线/选择动作）"
  "可视化编辑（拖动分割线/选择动作）" --> "写入 ui.reader.tap_zones"
  "写入 ui.reader.tap_zones" --> "后端 Config 表持久化"
  "应用启动/刷新设置" --> "读取 /api/v1/settings"
  "读取 /api/v1/settings" --> "Pinia: appSettingsStore.readerTapZones"
  "Pinia: appSettingsStore.readerTapZones" --> "ReaderView 点击区域覆盖层"
  "ReaderView 点击区域覆盖层" --> "翻页/展开收起工具条等动作"
```

## 默认行为（开箱即用）

- 左侧区域：上一页
- 中间区域：切换进度工具条（展开/收起）
- 右侧区域：下一页

默认分割比例：`30% / 40% / 30%`。

## 相关实现

- 后端默认设置：`backend/app/services/settings_service.py`
- 前端设置仓库：`frontend/src/store/appSettings.js`
- 阅读器页面：`frontend/src/views/ReaderView.vue`
- 覆盖层与配置界面：`frontend/src/components/reader/tapZones/`

