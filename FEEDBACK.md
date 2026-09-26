# 指标、图表、提示与反馈

这些组件挂载在 `createSurface()` 创建的区域内，沿用该区域的组件库与配色。所有显示文字均按纯文字处理，不解析 HTML。下列 API 由区域同名方法提供；各方法的第二个参数可指定区域内的挂载节点。

## 公共约定

- 返回 `element`、`update(patch)`、`destroy()`；更新只合并提供的属性。
- 区域切换配色不会重建组件、丢失打开状态或焦点。换库需创建新的区域。
- `destroy()` 可重复调用；卸载后更新或操作实例会报错，旧节点不再产生业务回调。
- 数据与业务结果由调用方提供。组件不会保存、删除、导出、上传或宣称业务操作成功。

## 数字指标与进度

`surface.statistic({ label, value, suffix, note })`：标签、展示值、单位与补充说明均为文字。数字的格式化由调用方决定。

`surface.progress({ label, value: 0, max: 100 })`：使用原生进度条；值限制在零至上限之间，上限无效时使用 100。未传标签时按进度显示等待开始、进行中或已完成。返回的 `control` 是进度条节点。

## 图表

```js
const chart = surface.chart({
  type: 'bar',
  title: '每日处理量',
  unit: ' 条',
  data: [{ label: '周一', value: 12 }, { label: '周二', value: 20 }],
  onSelect(item, index) { console.log(item, index); },
});
chart.update({ data: [{ label: '第一周', value: 90 }] });
```

- `type`：`bar`、`line`、`donut`；默认 `bar`。
- `data`：`{ label, value }` 数组，默认为空。只接收非负有限数值；负数、缺失值、非数字、NaN 和 Infinity 会报错，更新失败时保留旧图。该组件适用于非负计数或占比数据。
- `title`、`unit`、`emptyLabel`：标题、数值单位与空数据提示；默认空提示为“暂无数据”。
- `onSelect(item, index)`：柱形按钮可用鼠标或键盘选择，返回显示所用的数据副本及零起始位置；折线和环形图只展示数据，沿用已确认样稿，不增加无业务动作的按钮。
- `centerLabel`、`centerValue`：仅环形图使用；默认中心文字为“合计”和实际类别数量。
- 空数组显示空提示，全零环形图显示空环，单点折线保持有效坐标。环形图按非负数值占比计算；颜色依次使用强调色、次要文字色和边线色，超过三类时循环，所有类别保留文字与数值。
- 周期切换由调用方提供选择控件并调用 `update({ data })`；柱图与折线可使用同一组数据。没有网络请求、自动汇总、趋势判断或统计结论。

## 文字提示

`surface.tooltip({ label: '查看提示', text: '说明文字' })`。

支持悬停、真实键盘焦点和 Escape（退出键）；按退出键后，在新的悬停或聚焦之前保持关闭。鼠标可移入提示本身。返回 `trigger` 和 `bubble`。

## 操作菜单

```js
const menu = surface.menu({
  label: '更多操作',
  items: [
    { label: '复制链接', value: 'copy' },
    { label: '管理权限', value: 'manage', disabled: true },
  ],
  onSelect(value, item, index) { console.log(value, item, index); },
});
```

- `items` 默认空数组；每项包括 `label`、可选的 `value`、`id`、`disabled`。
- `onSelect` 第一个参数优先使用 `value`，其次 `id`，最后使用零起始位置；第二个参数是该选项的浅副本。
- 返回 `trigger`、`panel`、`open()`、`close()`、只读 `isOpen`。打开后聚焦第一项；方向键、Home、End 跳过禁用项。确认选择或 Escape 关闭并恢复入口焦点；Tab 和点击外部关闭。
- 菜单自身不执行复制、导出或权限变更。

## 操作确认

`surface.confirm({ triggerLabel, title, description, confirmLabel, cancelLabel, onConfirm, onCancel, onOpenChange })`。

默认入口“操作确认”、标题“确认操作”、按钮“确认”和“取消”。返回 `trigger`、`panel`、`open()`、`close()`、只读 `isOpen`。使用居中模态弹层，打开时聚焦取消；Tab 焦点限制在弹层内。取消按钮、Escape 和 `close()` 只触发 `onCancel()`。确认按钮关闭本次弹层后触发一次 `onConfirm()`；再次打开后可发起下一次确认。`onOpenChange(boolean)` 在打开或关闭时通知调用方。销毁会退出模态状态，不触发确认或取消业务回调。异步操作结果须由调用方另行展示。

## 行内提示与内容反馈

`surface.alert({ type: 'info', text })`：`type` 支持 `info`、`success`、`warning`、`error`。错误使用警报语义，其余使用状态语义。

`surface.feedback({ state, label, title, description, actionLabel, onRetry, onAction })`：

- `state`：`normal`（默认）、`success`、`loading`、`skeleton`、`empty`、`error`。
- `label`、`title` 提供时覆盖该状态默认文字；`description` 是额外说明。
- 加载状态显示旋转指示及骨架；`skeleton` 只显示骨架；减少动态效果偏好会停止旋转和闪动。
- `actionLabel` 创建操作按钮；错误状态提供 `onRetry` 时，默认显示“重新尝试”。错误状态优先调用 `onRetry()`，其他情况调用 `onAction()`。
- 重试不会自动改成成功。调用方收到真实结果后使用 `update()` 更新状态。
- 每个实例独立，加载、空内容和失败可以同时展示。

## 消息、图标与动效

`surface.toast({ text, duration: 3200, closable: true, onClose })`：创建时显示消息，时长单位毫秒；零或负数表示不自动关闭。手动关闭或到期调用一次 `onClose()`；关闭后清理计时器并隐藏消息，仍保留实例供 `open()` 重用；`destroy()` 移除节点并清理全部资源。`update()` 重设当前消息的倒计时。返回 `open()`、`close()` 和只读 `isOpen`。

消息在指定挂载位置排列，多个实例不会覆盖；没有全局固定浮层。调用方需要页面角落的通知时，可将独立的消息容器安排在所需位置。

`surface.iconSet({ label, names })`：默认提供五个图标，保留当前库的线性、实心或双色风格。`names` 仅接受包内已有的 Phosphor 图标名称；无效名称报错。默认可读名称为“图标风格样例”。

`surface.motion({ label: '重播动效', text: '内容更新完成', icon: 'check-circle', onReplay })`：返回 `sample` 与 `replay()`。每次重播调用 `onReplay()`，三库分别沿用平移、弹性缩放与分段揭示。该文案只是调用方展示内容，不代表实际操作结果；遵循减少动态效果偏好。
