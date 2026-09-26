# 数据表格与筛选

通过 `surface.table(options, target?)` 单独挂载数据表。数据、操作回调由调用方提供；组件只管理本页的显示与选择，不请求服务、不自动修改业务记录。

```js
const table = surface.table({
  label: '项目数据表',
  rows: [
    { id: 1, name: '演示甲', status: '进行中', count: 20 },
    { id: 2, name: '演示乙', status: '已完成', count: 40 },
  ],
  columns: [
    { key: 'name', label: '项目', sortable: true, hideable: false },
    { key: 'status', label: '状态', tag: true },
    { key: 'count', label: '记录数', sortable: true },
  ],
  filters: [{ key: 'status', label: '按状态筛选', options: [
    { value: '进行中', label: '进行中' }, { value: '已完成', label: '已完成' },
  ] }],
  pageSize: 3,
  batchActions: [{ id: 'mark', label: '批量标记' }],
  onBatch(action, ids) {
    // 在此连接真实业务；这里只更新演示用标记。
    table.update({ marked: ids });
  },
});
```

## 属性与行为

| 属性 | 约定 |
|---|---|
| `rows` | 行对象数组，默认空。`rowKey` 默认 `id`，每行标识须存在且转为字符串后唯一；标识原值用于回调。 |
| `columns` | 必填的非空数组，`{ key, label, sortable?, hideable?, tag? }`。列键不重复；`hideable:false` 固定显示；`tag:true` 以状态标签显示内容。 |
| `searchKeys` | 搜索字段数组，默认全部列；忽略首尾空格和文字大小写。 |
| `filters` | `{ key,label,allLabel?,options:[{value,label}] }[]`，按字段严格匹配；空字符串代表全部，不能用作业务筛选值。多个筛选与搜索同时生效。 |
| `pageSize`／`pageSizes` | 默认每页 3 条，可选 2、3、6；须为正整数。更换条数或筛选会回到第一页，结果减少时自动约束到有效页。 |
| `batchActions` | `{id,label,disabled?}[]`，默认不提供业务批量操作；没有选择时禁用，选择后仅回调所选标识。 |
| `emptyText` | 无结果的提示文字。 |

`query`、`filterValues`、`sort:{key,direction:'asc'|'desc'}`、`page`、`selected`、`visibleColumns`、`marked` 可通过初始属性或 `update(patch)` 设置。`sort:null` 取消排序，数字按数值排序，其他内容按文字排序。只有显式传入的状态会替换当前值。

- 当页全选只选择本页；跨页、搜索或筛选不清空之前选择。取消当页全选只取消本页。清除选择会清空整个表格的选择。
- 数据更新时移除已经不存在的行选择。排序、筛选与列显隐不会修改调用方的原始数据。
- `onSelectionChange(ids)` 在用户改变选择时通知；`onChange(state)` 通知用户引发的表格状态变化；`onBatch(actionId,ids)` 交给调用方处理批量操作。程序 `update` 不触发这些回调。
- 返回 `element`、`state`（当前状态副本）、`update`、`destroy`。移除组件或区域后不再响应旧节点事件。
- 单元格按文字呈现，不能传 HTML 字符串执行脚本。此版不包含单元格编辑、服务端分页或虚拟滚动；面向已加载到本机的小型数据集合。
