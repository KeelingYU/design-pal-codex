import { createSurface, libraries } from '../index.mjs';
import { componentGroups } from '../libraries/component-list.mjs';
import { node } from '../components/dom.mjs';

const libraryId = new URL(location.href).searchParams.get('library') || 'order';
if (!Object.hasOwn(libraries, libraryId)) {
  document.getElementById('catalog').textContent = '没有找到这个组件库，请返回选择。';
} else start();

function start() {
  const library = libraries[libraryId];
  const surface = createSurface(document.getElementById('catalog'), { library: libraryId });
  surface.element.classList.add('catalog-surface');
  document.getElementById('library-name').textContent = `${library.name} · 组件验证`;
  const paletteTabs = document.getElementById('colors');
  library.colors.forEach(color => {
    const button = node(document, 'button', '', color.name); button.type = 'button'; button.setAttribute('role', 'tab');
    button.dataset.color = color.id; button.addEventListener('click', () => { surface.setAppearance({ color: color.id }); paintControls(); });
    paletteTabs.append(button);
  });
  paletteTabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const current = library.colors.findIndex(color => color.id === surface.appearance.color);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? library.colors.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : library.colors.length - 1)) % library.colors.length;
    surface.setAppearance({ color: library.colors[next].id }); paintControls(); paletteTabs.children[next].focus();
  });
  document.getElementById('mode').addEventListener('click', () => {
    surface.setAppearance({ mode: surface.appearance.mode === 'light' ? 'dark' : 'light' }); paintControls();
  });
  function paintControls() {
    [...paletteTabs.children].forEach(button => { const selected = surface.appearance.color === button.dataset.color; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
    document.getElementById('mode').textContent = surface.appearance.mode === 'light' ? '切换暗色' : '切换亮色';
  }
  paintControls();
  const sections = {};
  for (const group of componentGroups) {
    const link = node(document, 'a', '', group.label); link.href = `#${group.id}`; document.getElementById('groups').append(link);
    const section = node(document, 'section', 'catalog-group'); section.id = group.id; section.append(node(document, 'h2', '', group.label));
    const grid = node(document, 'div', 'catalog-grid'); section.append(grid); surface.element.append(section); sections[group.id] = grid;
  }
  function cell(group, label, width = '') {
    const wrap = node(document, 'section', `catalog-cell ${width}`); wrap.append(node(document, 'h3', '', label)); sections[group].append(wrap); return wrap;
  }
  function mount(method, props, target) {
    const component = surface[method](props, target); component.element.dataset.component = method; return component;
  }
  function output(target) { const result = node(document, 'p', 'catalog-result'); result.setAttribute('role', 'status'); target.append(result); return value => { result.textContent = value; }; }
  const basics = cell('basic', '按钮状态并列：悬停和焦点为展示样例', 'wide'); const buttonStates = node(document, 'div', 'catalog-grid states'); basics.append(buttonStates);
  for (const state of ['正常', '悬停样例', '焦点样例', '禁用', '加载']) {
    const place = node(document, 'div'); place.append(node(document, 'h3', '', state)); buttonStates.append(place);
    const report = output(place);
    const button = mount('button', { label: state === '加载' ? '处理中' : '主要操作', disabled: state === '禁用', loading: state === '加载', onPress: () => report('收到演示操作') }, place);
    if (state === '悬停样例') button.element.classList.add('catalog-hover-sample');
    if (state === '焦点样例') button.element.classList.add('catalog-focus-sample');
    mount('button', { label: '次要操作', variant: 'secondary', disabled: state === '禁用', loading: state === '加载' }, place);
    mount('button', { label: '', ariaLabel: `${state}添加示例`, icon: 'plus', disabled: state === '禁用', loading: state === '加载' }, place);
  }
  for (const state of ['正常', '已填写', '焦点样例', '错误', '禁用']) {
    const place = cell('basic', state);
    const input = mount('input', { label: `${state}项目名称`, value: state === '已填写' ? '演示项目' : '', error: state === '错误' ? '请填写项目名称' : '', disabled: state === '禁用' }, place);
    if (state === '焦点样例') input.control.classList.add('catalog-focus-sample');
  }
  mount('toggle', { label: '接收通知', value: true }, cell('basic', '开关'));
  mount('segmented', { label: '优先级', options: [{ value: 'normal', label: '普通' }, { value: 'high', label: '优先' }], value: 'normal' }, cell('basic', '分段选择'));
  const options = [{ value: 'view', label: '查看' }, { value: 'edit', label: '编辑' }, { value: 'admin', label: '管理（禁用）', disabled: true }];
  mount('select', { label: '所属团队', options: [{ value: 'product', label: '产品团队' }, { value: 'data', label: '数据团队' }], value: 'product' }, cell('forms', '单选下拉'));
  mount('select', { label: '禁用下拉', options, value: 'view', disabled: true }, cell('forms', '禁用状态'));
  mount('checkboxGroup', { label: '多选权限', options, value: ['view'] }, cell('forms', '复选与多选'));
  mount('radioGroup', { label: '通知方式', options: [{ value: 'inbox', label: '站内' }, { value: 'mail', label: '邮件' }, { value: 'sms', label: '短信（禁用）', disabled: true }], value: 'inbox' }, cell('forms', '单选组'));
  mount('number', { label: '数量', value: 10, min: 1, max: 99, hint: '范围 1～99' }, cell('forms', '数字输入'));
  mount('slider', { label: '阈值', value: 60, min: 0, max: 100, unit: '%' }, cell('forms', '滑杆'));
  mount('dateRange', { label: '日期范围', value: { start: '2026-09-01', end: '2026-09-27' } }, cell('forms', '日期先后校验', 'double'));
  mount('textarea', { label: '补充说明', value: '', maxlength: 180, placeholder: '填写补充说明' }, cell('forms', '多行输入与字数统计', 'double'));
  mount('filePicker', { label: '演示附件', multiple: true }, cell('forms', '只显示名称，不读取或上传', 'double'));

  const tablePlace = cell('table', '搜索、筛选、跨页选择与批量反馈', 'wide');
  const tableResult = output(tablePlace);
  const rows = [
    { id: 101, name: '客户服务工作台', status: '进行中', owner: '演示甲', entries: 128 },
    { id: 102, name: '团队知识中心', status: '已就绪', owner: '演示乙', entries: 356 },
    { id: 103, name: '运营数据看板', status: '待评审', owner: '演示甲', entries: 82 },
    { id: 104, name: '订单管理后台', status: '进行中', owner: '演示乙', entries: 640 },
    { id: 105, name: '内容审核平台', status: '已就绪', owner: '演示甲', entries: 215 },
    { id: 106, name: '数据导入中心', status: '待评审', owner: '演示乙', entries: 48 },
  ];
  const table = mount('table', { label: '项目数据表', rows,
    columns: [{ key: 'name', label: '项目名称', sortable: true, hideable: false }, { key: 'status', label: '状态', tag: true, hideable: false }, { key: 'owner', label: '负责人' }, { key: 'entries', label: '记录数', sortable: true }],
    filters: [{ key: 'status', label: '按状态筛选', allLabel: '全部状态', options: ['进行中', '已就绪', '待评审'].map(value => ({ value, label: value })) }, { key: 'owner', label: '按负责人筛选', allLabel: '全部负责人', options: ['演示甲', '演示乙'].map(value => ({ value, label: value })) }],
    batchActions: [{ id: 'mark', label: '批量标记' }], onBatch(action, ids) { table.update({ marked: [...new Set([...table.state.marked, ...ids])] }); tableResult(`已在示例中标记 ${ids.length} 条，真实数据未改变。`); },
  }, tablePlace);

  const pathPlace = cell('navigation', '面包屑与页面导航', 'wide'); const pathResult = output(pathPlace);
  mount('breadcrumb', { items: [{ id: 'workspace', label: '工作空间' }, { id: 'projects', label: '项目' }, { id: 'data', label: '数据管理' }], onChange: id => pathResult(`收到导航：${id}`) }, pathPlace);
  mount('pageNav', { label: '示例页面导航', items: [{ id: 'all', label: '全部项目' }, { id: 'pending', label: '待处理' }, { id: 'ready', label: '已就绪' }], onChange: id => pathResult(`当前分组：${id}`) }, pathPlace);
  mount('tabs', { label: '内容页签', items: [{ id: 'overview', label: '概览', content: '集中查看数据、成员与最近活动。' }, { id: 'members', label: '成员', content: '3 位演示成员。' }, { id: 'history', label: '活动', content: '最近一次演示更新已经完成。' }] }, cell('navigation', '内容页签'));
  mount('tree', { label: '团队目录', items: [{ id: 'workspace', label: '工作空间', children: [{ id: 'product', label: '产品团队' }, { id: 'data', label: '数据团队' }] }], expanded: ['workspace'], value: 'product' }, cell('navigation', '导航树'));
  const stepsPlace = cell('navigation', '步骤条'); const stepsResult = output(stepsPlace);
  mount('steps', { items: [{ id: 'source', label: '配置来源', content: '选择数据来源。' }, { id: 'fields', label: '字段映射', content: '核对字段对应关系。' }, { id: 'confirm', label: '确认内容', content: '检查演示配置。' }], onComplete: () => stepsResult('演示步骤已完成') }, stepsPlace);
  mount('accordion', { items: [{ id: 'scope', label: '包含哪些内容？', content: '通用组件、配色、亮暗模式和使用示例。' }, { id: 'usage', label: '适合什么场景？', content: library.fit.join('、') }] }, cell('navigation', libraryId === 'ease' ? '折叠面板 · 可同时展开' : '折叠面板 · 单项展开'));
  const people = cell('navigation', '头像与徽标'); const peopleRow = node(document, 'div', 'catalog-row'); people.append(peopleRow);
  mount('avatar', { label: '演示甲', text: '甲' }, peopleRow); mount('avatar', { label: '演示乙', text: '乙' }, peopleRow); mount('badge', { label: '待处理', value: 7 }, peopleRow);
  mount('timeline', { items: [{ id: 'import', label: '10:30', content: '完成演示数据导入' }, { id: 'update', label: '09:15', content: '更新演示配置' }] }, cell('navigation', '时间线'));

  const periodPlace = cell('metrics', '同一组数据切换周期', 'wide'); const metric = mount('statistic', { label: '处理记录', value: 0, note: '模拟数据' }, cell('metrics', '数字指标'));
  const reportChart = output(periodPlace);
  const bar = mount('chart', { type: 'bar', title: '处理记录', data: [], unit: ' 条', onSelect: item => reportChart(`${item.label}：${item.value} 条`) }, cell('metrics', '柱状图'));
  const line = mount('chart', { type: 'line', title: '变化趋势', data: [] }, cell('metrics', '折线图'));
  mount('chart', { type: 'donut', title: '来源分布', data: [{ label: '直接录入', value: 60 }, { label: '批量导入', value: 25 }, { label: '其他', value: 15 }], unit: '%' }, cell('metrics', '环形图'));
  function setPeriod(period) {
    const values = period === 'week' ? [152, 188, 146, 220, 165, 240, 173] : [610, 704, 830, 800];
    const data = values.map((value, index) => ({ value, label: period === 'week' ? `周${['一', '二', '三', '四', '五', '六', '日'][index]}` : `第 ${index + 1} 周` }));
    bar.update({ data }); line.update({ data }); metric.update({ value: values.reduce((a, b) => a + b, 0) });
  }
  mount('segmented', { label: '统计周期', options: [{ value: 'week', label: '本周' }, { value: 'month', label: '本月' }], value: 'week', onChange: setPeriod }, periodPlace); setPeriod('week');
  for (const value of [60, 100, 0]) mount('progress', { value }, cell('metrics', `进度 ${value}%`));

  mount('tooltip', { label: '悬停或聚焦查看提示', text: '说明仅在需要时出现。' }, cell('overlays', '文字提示'));
  const menuPlace = cell('overlays', '操作菜单'); const menuResult = output(menuPlace);
  mount('menu', { label: '更多操作', items: [{ id: 'copy', label: '复制链接' }, { id: 'export', label: '导出记录' }, { id: 'admin', label: '管理权限（禁用）', disabled: true }], onSelect: value => menuResult(`${value}：收到演示操作，不执行真实复制或导出。`) }, menuPlace);
  const confirmation = cell('overlays', '操作确认'); const confirmResult = output(confirmation);
  mount('confirm', { triggerLabel: '预览归档确认', title: '归档这条演示记录？', description: '这里只体验确认与取消，不会操作真实数据。', onConfirm: () => confirmResult('已确认演示，真实数据未改变。'), onCancel: () => confirmResult('已取消，当前内容保持。') }, confirmation);
  for (const [type, text] of [['info', '提示：可以继续编辑。'], ['success', '成功：演示内容已保存。'], ['warning', '注意：请检查必填项。'], ['error', '错误：请修正后重试。']]) mount('alert', { type, text }, cell('overlays', '行内提示'));
  for (const [state, title] of [['normal', '正常内容'], ['loading', '正在加载'], ['skeleton', '骨架屏'], ['empty', '暂无内容'], ['error', '暂时无法加载'], ['success', '操作成功']]) {
    const place = cell('feedback', title); const result = output(place);
    mount('feedback', { state, title, description: '模拟业务状态，各实例保留供对照。', onRetry: () => result('已收到重试，错误样例仍保留。'), onAction: () => result('已收到演示操作。') }, place);
  }
  const toastPlace = cell('feedback', '消息提示');
  const toastHost = node(document, 'div', 'catalog-toast-host'); toastPlace.append(toastHost);
  const toast = mount('toast', { text: '演示消息，不影响其他组件', duration: 3000, closable: false }, toastHost); toast.close();
  mount('button', { label: '显示消息', onPress: () => toast.open() }, toastPlace);
  mount('details', { title: '项目详情', description: library.interaction, content: '这段内容来自调用方。', triggerLabel: '预览详情' }, cell('interaction', '三库不同详情方式'));
  mount('iconSet', { label: '组件库图标', names: ['folder', 'rows', 'check-circle', 'warning'] }, cell('interaction', '图标风格'));
  mount('motion', { text: '内容更新完成' }, cell('interaction', '实际操作与减少动态效果'));
}
