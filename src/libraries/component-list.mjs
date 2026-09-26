// 正式组件入口与开发验证目录共用的覆盖清单。
export const componentGroups = [
  { id: 'basic', label: '按钮与基础输入', methods: ['button', 'input', 'toggle', 'segmented'] },
  { id: 'forms', label: '高级表单', methods: ['select', 'checkboxGroup', 'radioGroup', 'number', 'slider', 'dateRange', 'textarea', 'filePicker'] },
  { id: 'table', label: '数据表格与筛选', methods: ['table'] },
  { id: 'navigation', label: '导航与结构', methods: ['breadcrumb', 'pageNav', 'tabs', 'tree', 'steps', 'accordion', 'avatar', 'badge', 'timeline'] },
  { id: 'metrics', label: '指标与图表', methods: ['statistic', 'chart', 'progress'] },
  { id: 'overlays', label: '弹层与提示', methods: ['tooltip', 'menu', 'confirm', 'alert'] },
  { id: 'feedback', label: '内容反馈', methods: ['feedback', 'toast'] },
  { id: 'interaction', label: '交互、图标与动效', methods: ['details', 'iconSet', 'motion'] },
];
