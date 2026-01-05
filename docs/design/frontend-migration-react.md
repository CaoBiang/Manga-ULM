# 前端迁移：从 Vue + AntDesign-Vue 到 React 19 + Ant Design v6（设计）

## 目标

- 放弃 Vue，统一使用 React 19 + Ant Design v6。
- 在迁移过程中保持 UI 风格一致（黑白灰毛玻璃），并确保所有文案仍走 i18n。
- 迁移不追求向前兼容：可以重构目录结构与状态模型，但必须保留“设置项 Key”（`ui.*`）与后端接口契约。

## 当前落地状态

- React 前端入口：`apps/web/src/main.tsx`、`apps/web/src/app/App.tsx`。
- 路由：`apps/web/src/app/router.tsx`（使用 `handle.titleKey/fullScreen` 替代 `meta`）。
- 状态管理：Zustand（`apps/web/src/store/appSettings.ts`）。
- 迁移结论：已完成迁移，仓库内不再保留旧版 Vue 工程。

```mermaid
flowchart LR
  "apps/web/src（React 前端）" --> "页面 -> 组件 -> Store"
```

## AntDesign-Vue -> Ant Design（React）映射

### 常用组件

| AntDesign-Vue（Vue） | Ant Design（React） | 说明 |
| --- | --- | --- |
| `a-button` | `Button` | 事件从 `@click` 变为 `onClick` |
| `a-input` / `a-input-search` | `Input` / `Input.Search` | 受控：`value` + `onChange` |
| `a-select` | `Select` | 选项建议用 `options`，避免散落的 `Option` |
| `a-switch` | `Switch` | `checked` + `onChange` |
| `a-form` / `a-form-item` | `Form` / `Form.Item` | 表单校验机制不同，优先使用 `Form` 的 `rules` |
| `a-menu` / `a-sub-menu` | `Menu` | 建议用 `items` 配置驱动 |
| `a-layout` / `a-layout-sider` | `Layout` / `Layout.Sider` | 与 `Menu` 组合成 Manager Shell |
| `notification` / `message` | `notification` / `message` | API 类似，注意统一中文文案与 i18n |

### 图标

- `@ant-design/icons-vue` -> `@ant-design/icons`
- 仍需关注 `.anticon { vertical-align: -0.125em; }` 的“偏下”问题，统一在 `body.app-is-manager` 作用域内处理（见 `docs/standard/manager-ui.md`）。

## Vue -> React 关键差异（迁移要点）

### 1) 双向绑定

- Vue：`v-model`
- React：受控组件（`value` + `onChange`）

示例（伪代码）：

- Vue：`"v-model:value=\"formValue\""`
- React：`"value={formValue} onChange={(e) => setFormValue(e.target.value)}"`

### 2) 插槽

- Vue：`slot/#extra`
- React：`children/props.extra`

本项目已提供 React 版毛玻璃容器：

- `apps/web/src/components/glass/ui/GlassPage.tsx`
- `apps/web/src/components/glass/ui/GlassSurface.tsx`

### 3) 路由元信息

- Vue Router：`meta.titleKey/fullScreen`
- React Router：`handle.titleKey/fullScreen`（见 `apps/web/src/app/router.tsx`）

### 4) Store

- Pinia：按 `defineStore` 拆分
- Zustand：按领域拆分 `useXxxStore`，并用“动作函数”封装写后端设置的逻辑

## 推荐迁移顺序（从可用到完整）

1. 先迁移“壳”：`ManagerLayout` + `PageHeader` + i18n 初始化 + 设置加载。
2. 迁移“设置页”：语言、管理器外观（毛玻璃参数），确保 CSS 变量闭环。
3. 迁移“书库页”：列表/分页/筛选 -> 卡片视图 -> 标签筛选。
4. 迁移“阅读器”：图片加载/翻页/工具条 -> 书签 -> 点击区域（Tap Zones）。
5. 最后迁移“维护/编辑/任务管理器”等长尾页面与任务通知。

## 注意事项（强制）

- 所有新文案必须走 i18n；禁止写死中文/英文。
- 所有 UI 外观参数必须可配置，并写入后端设置 Key（`ui.*`），禁止在组件里写死。
- Mermaid 图中所有文本必须用双引号包裹。
