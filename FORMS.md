# 表单组件

通过 `createSurface(container, appearance)` 创建组件区域后，调用下表的方法。每个方法都是 `surface.方法(props, target?)`，省略挂载位置时放在当前区域。需要加载组件入口配套的样式文件。

## 通用约定

- `label`：必填，显示标签，提供无障碍名称。
- `hint`：提示文字，默认空。`error`：业务错误文字，默认空；有错误时优先显示错误。
- `disabled`：是否禁用，默认 `false`。禁用组件和禁用选项不会执行业务回调。
- `value`：初始值或明确更新的值。`update({ hint, error, disabled })` 不覆盖用户值或重建输入控件；切色也保留控件、值、焦点和文本选择范围。
- 每个实例有 `element`、`controls`（控件数组）、只读 `value`、`update(patch)`、`destroy()`。单个控件组件另有 `control`。多选及日期的 `value` 返回副本。
- 用户修改触发 `onChange(value, event)`；数字、滑杆、多行文字和日期范围另支持 `onInput(value, event)`。程序调用 `update()` 不触发回调。`onInput` 表示编辑过程中的变化，`onChange` 的提交时机沿用浏览器规则。
- 数字和日期的非法输入仍交给业务回调，以便业务保存草稿或提示；显示错误不等于自动拒绝业务提交。业务应在提交前检查控件的原生有效性及自己的规则。`error` 负责呈现业务错误，不替业务执行提交判断。
- 销毁组件或区域后，旧节点不再执行回调；调用已销毁实例的更新方法会报错。
- 字符串仅作为文字显示，不解析 HTML（网页标记）。

## 方法与属性

| 方法 | 附加属性与值 | 操作方式 |
|---|---|---|
| `toggle` | `value: boolean`，默认 `false` | 鼠标或空格切换，回调布尔值。 |
| `segmented` | `options`、`value: string`，默认空字符串 | 分段按钮；方向键跳过禁用选项，Home／End 到首尾，Enter／空格选择。 |
| `select` | `options`、`value: string`，默认空字符串 | 原生单选下拉；未提供匹配值时不预选。 |
| `checkboxGroup` | `options`、`value: string[]`，默认空数组 | 独立勾选多个选项；下方显示已选标签。 |
| `radioGroup` | `options`、`value: string`，默认空字符串 | 单选；每个实例有独立的组名，互不取消选择。 |
| `number` | `value: number \| null`；`min`、`max`、`step`；`required`、`readOnly`、`placeholder` | 支持上下限、步长及必填校验。空值回调 `null`，其他值回调数字。未设置步长时沿用浏览器默认 `1`。 |
| `slider` | `value: number`；`min`、`max`、`step`；`unit`（值后附加的文字） | 原生滑杆，方向键调整；默认范围与步长沿用浏览器的 `0`～`100`、`1`。越界设值由浏览器限制到可用范围。 |
| `dateRange` | `value: { start, end }`；`min`、`max`；`required`、`readOnly`；`startLabel`、`endLabel` | 日期字符串为 `YYYY-MM-DD`，空值为 `''`；默认两个控件名称为“开始日期”“结束日期”。结束早于开始会显示错误；额外返回 `start`、`end` 控件。多组日期可通过独立标签区分。 |
| `textarea` | `value: string`，默认空字符串；`maxlength`、`rows`（默认 `3`）；`required`、`readOnly`、`placeholder` | 显示当前字符计数；配置上限时显示“当前 / 上限”。输入上限与字符计数沿用浏览器 UTF-16 长度口径。 |
| `filePicker` | `multiple`（默认 `false`）、`accept`、`chooseLabel`（默认“选择本地文件”）、`removeLabel`（默认“移除文件选择”） | 原生文件选择；只列文件名，不读取内容或上传。值与回调均为文件名数组。 |

### 选项约定

`segmented`、`select`、`checkboxGroup`、`radioGroup` 接受同一格式：

```js
const options = [
  { value: 'view', label: '查看' },
  { value: 'edit', label: '编辑' },
  { value: 'manage', label: '管理', disabled: true },
];

const permissions = surface.checkboxGroup({
  label: '权限',
  options,
  value: ['view'],
  onChange(values) {
    // 在此处理业务中的权限选择。
  },
});
permissions.update({ hint: '当前修改尚未保存' });
```

`options` 默认空数组。每项 `value` 必须是唯一字符串，`label` 默认取该值，`disabled` 默认 `false`。更新选项列表时按选项值保留选择；仍存在且可用的已聚焦选项会重新获得焦点。业务值中暂时不在列表内的值仍保留，直到业务明确更新 `value`；它们不显示为可选项或标签。

### 文件边界

```js
const picker = surface.filePicker({
  label: '参考附件',
  accept: '.txt,.pdf',
  multiple: true,
  onChange(names) {
    // 这里只收到文件名数组；组件不提供上传动作。
  },
});
picker.clear(); // 程序清空选择，不触发 onChange。
```

用户点击移除会清空原生选择并回调空数组；`clear()` 同样清空，但不回调。文件不能用 `value` 属性预填或更新，传入会报错。`accept` 是浏览器选择提示，不是业务安全校验。文件、日期弹出的系统面板样式由操作系统和浏览器决定。
