# 导航与结构组件

通过 `createSurface(container, { library, color, mode })` 创建区域后，调用下列同名方法。每个方法接收 `options` 和可选的区域内 `target`，可单独挂载。公共样式入口为 `src/components/styles.css`。

所有实例都返回 `element`、`update(patch)`、`destroy()`。文字始终作为纯文字显示；`content` 支持文字或调用方创建的可信 DOM Node，不解析 HTML 字符串。数组条目必须提供当前组件内唯一、非空的字符串 `id`；用稳定的 `id` 更新文字可以保留控件节点和焦点。传入 `items` 会替换整个条目数组。卸载后不能再更新。

## 面包屑与页面导航

```js
const navigation = surface.pageNav({
  label: '项目导航',
  items: [{ id: 'home', label: '首页' }, { id: 'settings', label: '设置' }],
  value: 'home',
  onChange(id, item) { console.log(id, item.label); },
});
const path = surface.breadcrumb({
  items: [{ id: 'workspace', label: '工作空间' }, { id: 'project', label: '项目' }],
  onChange(id, item) { console.log(id, item.label); },
});
```

- 两者共有 `label`、`items`、`value`、`disabled`、`onChange(id, item)`；条目为 `{ id, label, disabled? }`。
- 页面导航条目还可提供 `icon`，取包内图标名（例如 `folder`、`squares-four`）；图标风格跟随库，未知名称会被拒绝。文字仍作为按钮可读名称。
- 页面导航沿用业务导航的间距与按钮外观，`ease` 为胶囊形；侧栏和窄轨道的方向、宽度及布局由宿主页面安排。
- `.value` 读取当前条目标识。页面导航默认首个可用条目；面包屑默认最后一个可用条目。当前面包屑不可点击。
- 点击更新当前项并通知调用方，实际页面切换由调用方处理，不自行跳转网址。

## 内容页签

`surface.tabs({ label?, items, value?, disabled?, onChange? })`

- 条目为 `{ id, label, content?, disabled? }`。`.value` 为当前页签标识。
- 默认首个可用项；无可用项时值为 `null`。当前项被移除或禁用时转到首个可用项。
- 支持左右方向键、Home、End；跳过禁用项，移动时自动选中。选中页签显示对应内容。
- `onChange(id, item)` 在用户改变选中项时触发，程序调用 `update` 不触发。

## 导航树

`surface.tree({ label?, items, value?, expanded?, disabled?, onChange?, onExpand? })`

- 条目为 `{ id, label, disabled?, children?: [...] }`，所有层级的标识必须唯一。
- `.value` 读取选择；`.expanded` 返回展开标识数组。`expanded` 初始默认为空数组。
- 点击文字选择；点击展开箭头展开或折叠。上下方向键在可见可用项间移动，右键展开／进入子项，左键收起／返回父项，Home／End 跳到首末项，Enter／空格选择。
- `onChange(id, item)` 通知选择，条目还包含 `parent`（父标识或 `null`）和 `depth`（从 1 开始的层数）；`onExpand(ids)` 通知展开状态。折叠父项保留子项选择。
- 删除选中项或将其禁用时选择首个可用项；移除的展开项自动清除。禁用项不可选择／展开，其已展开且可用的子项仍可操作。

## 步骤条

`surface.steps({ items, value?, disabled?, previousLabel?, nextLabel?, completeLabel?, onChange?, onComplete? })`

- 条目为 `{ id, label, content? }`。`value` 和实例 `.value` 是从 `0` 开始的整数步骤位置，越界时约束到现有范围。
- 默认按钮文字为“上一步”“下一步”“完成”。首步不能后退，空列表两按钮禁用。
- `onChange(index, item)` 在前后移动时触发；末步点击完成调用 `onComplete(item)`，不会自动关闭或清空业务数据。
- 仅更新条目时按稳定标识保留当前步骤；该步骤被移除时使用最接近的有效位置。

## 折叠面板

`surface.accordion({ items, expanded?, disabled?, onChange? })`

- 条目为 `{ id, label, content?, disabled? }`。`.expanded` 读取展开标识数组。
- `ease` 可以同时展开多个；`order` 和 `edge` 最多展开一个。向单开库传入多个展开标识时仅保留第一个有效标识。
- 点击或 Enter／空格切换；上下方向键、Home、End 在可用标题间移动。`onChange(ids)` 仅在用户切换时触发。
- 禁用标题不能切换，既有展开状态保留。更新普通文字保留展开和焦点；折叠包含焦点的内容时，焦点返回可用标题。

## 头像、徽标、时间线

| 方法 | 参数与行为 |
|---|---|
| `surface.avatar({ label, text? })` | 文字头像；`label` 是完整名称，`text` 是可选显示文字，默认显示名称第一个字符。未提供名称时使用“头像”作为可读名称。 |
| `surface.badge({ label, value })` | 标签和计数／状态文字；`value` 默认 `0`，不自动隐藏零值。 |
| `surface.timeline({ label?, items })` | 条目为 `{ id, label, content? }`；`label` 为时间或标题，内容由业务提供。组件不自动排序。 |

切换库内颜色和亮暗模式只改变配色，保留选择、展开、当前步骤和现有节点。库结构固定，换库需重新创建区域。
