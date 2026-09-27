import { libraries } from '../index.mjs';
import { projects, records } from './demo-data.mjs';
import { createIcon } from '../components/icon.mjs';
import { node } from '../components/dom.mjs';

export const catalogGroups = [
  ['buttons', '按钮'], ['fields', '输入与选择'], ['advanced-fields', '高级表单'],
  ['data-components', '表格与筛选'], ['navigation-components', '导航与结构'],
  ['metrics-components', '指标与图表'], ['overlay-components', '弹层与提示'],
  ['feedback', '内容反馈'], ['interactions', '交互与动效'],
].map(([id, label]) => ({ id, label }));

// 页面只组织组件与模拟业务数据；操作、校验、键盘和清理由独立组件承担。
export function mountCatalog(surface, container) {
  const document = container.ownerDocument;
  const libraryId = surface.appearance.library, library = libraries[libraryId];
  const element = node(document, 'div', 'formal-catalog');
  element.dataset.formalCatalog = '';
  container.append(element);
  const components = [], timers = new Set();
  const controller = new document.defaultView.AbortController();
  let alive = true;
  const el = (tag, cls = '', text = '', target = element) => { const item = node(document, tag, cls, text); target.append(item); return item; };
  function mount(method, props, target) {
    const component = surface[method](props, target);
    component.element.dataset.component = method;
    components.push(component);
    return component;
  }
  function report(target, id, initial = '') {
    const result = el('p', 'field-hint catalog-result', initial, target);
    if (id) result.id = id;
    result.setAttribute('role', 'status');
    return message => { result.textContent = message; };
  }
  const header = el('div', 'catalog-header');
  const title = el('div', 'catalog-title', '', header);
  const h1 = el('h1', '', library.name, title);
  el('span', 'catalog-heading-kind', '组件总览', h1);
  el('p', '', library.subtitle, title);
  el('span', 'sample-tag', '各状态并列展示 · 控件可操作', header);
  const catalog = el('div', 'catalog');
  const sections = {};
  const descriptions = ['主操作与次操作', '直接输入，体验校验与反馈', '常用输入与选择', '搜索、排序、多选、批量操作与分页', '路径、分组与多步任务', '模拟数据 · 可切换周期', '轻量提示和需要确认的操作', '正常、加载、空内容和失败同时可见', '每个库有自己的操作节奏'];
  catalogGroups.forEach((group, index) => {
    const section = el('section', 'catalog-section', '', catalog); section.id = group.id;
    const heading = el('div', 'section-head', '', section);
    el('span', 'section-number', String(index + 1).padStart(2, '0'), heading);
    el('h2', '', group.id === 'data-components' ? '数据表格与筛选' : group.id === 'overlay-components' ? '弹层、提示与通知' : group.id === 'interactions' ? '交互、图标与动效' : group.label, heading);
    el('p', '', descriptions[index], heading); sections[group.id] = section;
  });
  const toast = mount('toast', { text: '', duration: 3200, closable: false }, element);
  toast.element.classList.add('catalog-toast'); toast.close();
  const notify = text => { toast.update({ text }); toast.open(); };
  const states = el('div', 'state-grid', '', sections.buttons);
  for (const [state, label] of [['normal', '正常'], ['hover', '悬停'], ['focus', '焦点'], ['disabled', '禁用'], ['loading', '加载中']]) {
    const cell = el('div', 'state-cell', '', states); cell.dataset.componentState = state;
    el('span', 'state-label', label, cell);
    for (const variant of ['primary', 'secondary']) {
      const loading = state === 'loading';
      const button = mount('button', { label: loading ? (variant === 'primary' ? '提交中' : '处理中') : (variant === 'primary' ? '新建项目' : '查看详情'), variant, icon: !loading && variant === 'primary' ? 'plus' : undefined, disabled: state === 'disabled', loading, onPress: () => notify('操作反馈已显示，仅用于交互预览。') }, cell);
      if (state === 'hover' || state === 'focus') button.element.classList.add(`catalog-${state}-sample`);
      if (variant === 'primary') el('br', '', '', cell);
    }
  }
  const form = el('form', '', '', sections.fields); form.id = 'settings-form'; form.noValidate = true;
  const fields = el('div', 'field-grid', '', form);
  let saving = false;
  const changed = () => saveMessage('设置已修改');
  const name = mount('input', { label: '正常', value: '客户服务工作台', placeholder: '填写项目名称', onInput(value) { name.update({ error: value.trim() ? '' : '请填写项目名称。' }); changed(); } }, fields);
  name.control.setAttribute('aria-label', '项目名称');
  mount('input', { label: '已填写', value: '团队知识中心', hint: '可继续编辑' }, fields).control.setAttribute('aria-label', '已填写示例');
  const focus = mount('input', { label: '焦点样例', value: '焦点轮廓', readOnly: true, hint: '展示轮廓，不抢占实际焦点' }, fields);
  focus.control.classList.add('catalog-focus-sample');
  const error = mount('input', { label: '错误', value: 'A', error: '至少输入 2 个字符。', onInput(value) { error.update({ error: value.trim().length < 2 ? '至少输入 2 个字符。' : '', hint: '已修正，可以继续。' }); error.element.classList.toggle('catalog-valid', value.trim().length >= 2); } }, fields);
  mount('input', { label: '禁用', value: '此项暂不可编辑', disabled: true, hint: '不可操作' }, fields);
  const settings = el('div', 'settings-line', '', form);
  const notifications = mount('toggle', { label: '接收通知', value: true, onChange: changed }, settings);
  mount('toggle', { label: '关闭样例', value: false }, settings);
  mount('toggle', { label: '禁用样例', value: true, disabled: true }, settings);
  const priority = mount('segmented', { label: '优先级', options: ['低', '普通', '高'].map(value => ({ value, label: value })), value: '普通', onChange: changed }, settings);
  priority.element.classList.add('catalog-priority');
  const saveLine = el('div', 'save-line', '', form);
  const save = mount('button', { label: '保存设置' }, saveLine); save.element.type = 'submit';
  const saveMessage = report(saveLine, 'save-message', '仅用于本页体验');
  form.addEventListener('submit', event => {
    event.preventDefault(); if (saving) return;
    const savedName = name.control.value.trim();
    if (!savedName) { name.update({ error: '请填写项目名称。' }); name.control.focus(); return; }
    saving = true; name.update({ disabled: true, error: '' }); notifications.update({ disabled: true }); priority.update({ disabled: true });
    save.update({ label: '保存中…', loading: true }); saveMessage('正在保存演示设置…');
    const timer = document.defaultView.setTimeout(() => {
      timers.delete(timer); if (!alive) return; saving = false;
      name.update({ disabled: false }); notifications.update({ disabled: false }); priority.update({ disabled: false });
      save.update({ label: '保存设置', loading: false }); saveMessage(`已保存“${savedName}”的演示设置。`);
    }, 650); timers.add(timer);
  }, { signal: controller.signal });

  const advanced = el('div', 'extended-grid', '', sections['advanced-fields']);
  mount('select', { label: '单选下拉', options: ['产品团队', '运营团队', '数据团队'].map(value => ({ value, label: value })), value: '产品团队', hint: '选择所属团队' }, advanced);
  mount('select', { label: '禁用下拉', options: [{ value: 'none', label: '暂不可选择' }], value: 'none', disabled: true }, advanced);
  const permissions = mount('checkboxGroup', { label: '复选与多选', options: [...['查看', '编辑', '管理'].map(value => ({ value, label: value })), { value: 'disabled', label: '禁用', disabled: true }], value: ['查看', 'disabled'] }, advanced); permissions.element.classList.add('catalog-permissions');
  mount('radioGroup', { label: '单选组', options: [{ value: '站内', label: '站内' }, { value: '邮件', label: '邮件' }, { value: '短信', label: '短信（禁用）', disabled: true }], value: '站内' }, advanced);
  mount('number', { label: '数字输入', value: 10, min: 1, max: 99, hint: '范围 1～99' }, advanced);
  const slider = mount('slider', { label: '滑杆', value: 60, min: 0, max: 100, unit: '%', hint: '拖动或用方向键调整' }, advanced);
  slider.element.querySelector('label').append(document.createTextNode(' · '), slider.element.querySelector('output')); slider.element.classList.add('catalog-slider');
  const range = mount('dateRange', { label: '日期范围', value: { start: '2026-09-01', end: '2026-09-25' } }, advanced); range.element.classList.add('date-field');
  const notes = mount('textarea', { label: '多行输入', value: '', maxlength: 180, placeholder: '填写补充说明', rows: 3 }, advanced); notes.element.classList.add('textarea-field');
  const file = mount('filePicker', { label: '文件选择', chooseLabel: '选择本地示例文件' }, advanced); file.element.classList.add('upload-field');
  file.element.querySelector('.dpc-upload-box').prepend(createIcon(document, 'folder', library.icon));

  const tablePlace = sections['data-components'];
  const table = mount('table', { label: '项目数据表', rows: records, searchKeys: ['name', 'owner'], columns: [{ key: 'name', label: '项目名称', sortable: true, hideable: false }, { key: 'status', label: '状态', tag: true, hideable: false }, { key: 'owner', label: '负责人' }, { key: 'entries', label: '记录数', sortable: true }],
    filters: [{ key: 'status', label: '按状态筛选', allLabel: '全部状态', options: ['进行中', '已就绪', '待评审'].map(value => ({ value, label: value })) }, { key: 'owner', label: '按负责人筛选', allLabel: '全部负责人', options: ['林悦', '陈舟'].map(value => ({ value, label: value })) }],
    batchActions: [{ id: 'mark', label: '批量标记' }], onBatch(action, ids) { table.update({ marked: [...new Set([...table.state.marked, ...ids])] }); tableResult(`已标记 ${ids.length} 条演示记录，真实数据未改变。`); },
  }, tablePlace);
  const tableResult = report(tablePlace, 'table-result');
  table.element.querySelector('input[type=search]').placeholder = '搜索项目或负责人';

  const nav = sections['navigation-components'];
  mount('breadcrumb', { items: [{ id: 'workspace', label: '工作空间' }, { id: 'projects', label: '项目' }, { id: 'data', label: '数据管理' }], onChange: id => breadcrumbResult(`当前路径：${id === 'workspace' ? '工作空间' : '工作空间 / 项目'}`) }, nav);
  const breadcrumbResult = report(nav, 'breadcrumb-result', '当前路径：工作空间 / 项目 / 数据管理');
  const navigation = el('div', 'navigation-grid', '', nav);
  const tabCell = el('section', '', '', navigation);
  const content = ['overview', 'members', 'history'].map(() => node(document, 'div'));
  mount('tabs', { label: '内容页签', items: [{ id: 'overview', label: '概览', content: content[0] }, { id: 'members', label: '成员', content: content[1] }, { id: 'history', label: '活动', content: content[2] }] }, tabCell);
  el('h3', '', '数据管理空间', content[0]); el('p', '', '集中查看数据、成员与最近活动。', content[0]);
  const overviewPeople = el('div', 'avatar-row', '', content[0]);
  for (const text of ['林', '陈']) mount('avatar', { label: text === '林' ? '林悦' : '陈舟', text }, overviewPeople);
  el('span', 'tag', '成员 3', overviewPeople); mount('badge', { label: '待处理', value: 7 }, overviewPeople);
  const members = el('div', 'avatar-row', '', content[1]);
  for (const text of ['林', '陈', '周']) mount('avatar', { label: `${text}（演示成员）`, text }, members);
  el('span', '', '3 位演示成员', members);
  mount('timeline', { items: [{ id: 'import', label: '10:30', content: '完成数据导入' }, { id: 'update', label: '09:15', content: '更新字段配置' }, { id: 'create', label: '昨天', content: '创建项目' }] }, content[2]);
  const treeCell = el('section', '', '', navigation); el('h3', '', '导航树', treeCell);
  mount('tree', { label: '团队目录', items: [{ id: 'workspace', label: '工作空间', children: ['产品团队', '运营团队', '数据团队'].map(label => ({ id: label, label })) }], expanded: ['workspace'], value: '产品团队', onChange: (id, item) => treeResult(`当前选择：${item.label}`) }, treeCell);
  const treeResult = report(treeCell, 'tree-result', '当前选择：产品团队');
  const stepsCell = el('section', '', '', navigation); el('h3', '', '步骤条', stepsCell);
  mount('steps', { items: [{ id: 'source', label: '配置来源', content: '选择需要导入的数据来源。' }, { id: 'fields', label: '字段映射', content: '核对原始字段与目标字段的对应关系。' }, { id: 'confirm', label: '确认内容', content: '检查配置，确认后完成本次演示。' }], completeLabel: '完成演示', onComplete: () => notify('多步配置演示已完成。') }, stepsCell);

  const metrics = sections['metrics-components'];
  const toolbar = el('div', 'metric-toolbar', '', metrics); el('h3', '', '处理记录概览', toolbar);
  const metricGrid = el('div', 'metric-grid', '', metrics);
  const total = mount('statistic', { label: '处理记录', value: '1,284', note: '模拟数据' }, metricGrid);
  const success = mount('statistic', { label: '成功率', value: '98.6', suffix: '%', note: '用于状态展示' }, metricGrid);
  const pending = mount('statistic', { label: '待处理', value: '18', note: '可查看明细' }, metricGrid);
  const charts = el('div', 'chart-grid', '', metrics);
  const bar = mount('chart', { type: 'bar', title: '每日处理量', data: [], unit: ' 条', onSelect: item => chartResult(`${item.label}：${item.value} 条`) }, charts);
  const line = mount('chart', { type: 'line', title: '变化趋势', data: [] }, charts);
  mount('chart', { type: 'donut', title: '来源分布', centerLabel: '来源', data: [{ label: '直接录入', value: 60 }, { label: '批量导入', value: 25 }, { label: '其他', value: 15 }], unit: '%' }, charts);
  const chartResult = report(metrics, 'chart-selection', '点击柱形可查看对应数值。');
  const progress = el('div', 'progress-states', '', metrics);
  for (const value of [60, 100, 0]) mount('progress', { value }, progress);
  function setPeriod(period) {
    const values = period === 'week' ? [152, 188, 146, 220, 165, 240, 173] : [610, 704, 830, 800];
    const data = values.map((value, index) => ({ value, label: period === 'week' ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index] : `第 ${index + 1} 周` }));
    bar.update({ data }); line.update({ data }); el('p', 'field-hint', '与柱状图使用同一组模拟记录', line.element);
    total.update({ value: values.reduce((a, b) => a + b, 0).toLocaleString('en-US') }); success.update({ value: period === 'week' ? '98.6' : '97.2' }); pending.update({ value: period === 'week' ? '18' : '42' });
  }
  const period = mount('segmented', { label: '统计周期', options: [{ value: 'week', label: '本周' }, { value: 'month', label: '本月' }], value: 'week', onChange: setPeriod }, toolbar); period.element.classList.add('catalog-period'); setPeriod('week');

  const overlays = el('div', 'overlay-grid', '', sections['overlay-components']);
  const tooltip = el('section', '', '', overlays); el('h3', '', '文字提示', tooltip);
  mount('tooltip', { label: '悬停或聚焦查看提示', text: '说明仅在需要时出现。' }, tooltip);
  const menuCell = el('section', '', '', overlays); el('h3', '', '操作菜单', menuCell);
  mount('menu', { label: '更多操作', items: [{ id: 'copy', label: '复制链接' }, { id: 'export', label: '导出记录' }, { id: 'admin', label: '管理权限（禁用）', disabled: true }], onSelect: (id, item) => menuResult(`${item.label}：演示操作已触发。`) }, menuCell);
  const menuResult = report(menuCell, 'menu-result', '选择后在本页显示反馈');
  const confirmCell = el('section', '', '', overlays); el('h3', '', '操作确认', confirmCell);
  mount('confirm', { triggerLabel: '预览归档确认', title: '归档这条演示记录？', description: '这里只体验确认与取消，不会操作真实数据。', confirmLabel: '确认归档', onConfirm: () => confirmResult('已确认归档演示，真实数据未改变。'), onCancel: () => confirmResult('已取消，当前内容保持。') }, confirmCell);
  const confirmResult = report(confirmCell, 'confirm-result', '取消操作不会改变当前内容。');
  const alerts = el('div', 'alert-grid', '', sections['overlay-components']);
  for (const [type, text] of [['info', '提示：可以继续编辑。'], ['success', '成功：内容已经保存。'], ['warning', '注意：请检查必填项。'], ['error', '错误：请修正后重试。']]) mount('alert', { type, text }, alerts);

  const feedback = el('div', 'feedback-grid', '', sections.feedback);
  const ready = mount('feedback', { state: 'normal', title: '内容已准备好', description: '所有修改已保存，可以继续操作。', actionLabel: '查看消息反馈', onAction: () => notify('操作反馈已显示，仅用于交互预览。') }, feedback);
  ready.element.querySelector('button').append(createIcon(document, 'caret-right', library.icon));
  mount('feedback', { state: 'loading', title: '正在加载内容' }, feedback);
  mount('feedback', { state: 'empty', title: '还没有项目', description: '项目创建后会显示在这里。', actionLabel: '试用新建提示', onAction: () => notify('新建操作已触发；空内容样例保留供对照。') }, feedback);
  let recovered = false;
  const retry = () => { recovered = !recovered; failure.update({ state: recovered ? 'success' : 'error', label: '失败', title: recovered ? '已恢复连接' : '暂时无法加载', description: recovered ? '重试反馈已展示，其他状态保持可见。' : '当前内容未丢失，可以重新尝试。', actionLabel: recovered ? '再次演示失败' : '重新尝试' }); };
  const failure = mount('feedback', { state: 'error', title: '暂时无法加载', description: '当前内容未丢失，可以重新尝试。', onRetry: retry, onAction: retry }, feedback);

  const interactions = el('div', 'interaction-grid', '', sections.interactions);
  const detailCell = el('section', 'interactive-sample', '', interactions);
  el('h3', '', libraryId === 'order' ? '从侧边查看详情' : libraryId === 'ease' ? '居中查看详情' : '就地展开详情', detailCell);
  const item = projects[0];
  const detailContent = node(document, 'div', 'detail-content');
  el('p', 'detail-eyebrow', `项目详情 / ${String(item.id).padStart(2, '0')}`, detailContent);
  el('h2', '', item.name, detailContent); el('p', '', item.description, detailContent);
  const dl = el('dl', '', '', detailContent);
  for (const [label, value] of [['负责人', item.owner], ['当前状态', item.status], ['项目类型', item.type], ['最近更新', item.date]]) { const row = el('div', '', '', dl); el('dt', '', label, row); el('dd', '', value, row); }
  el('p', 'detail-eyebrow', `完成进度 · ${item.progress}%`, detailContent);
  const detailProgress = el('div', 'progress', '', detailContent); el('span', '', '', detailProgress).style.width = `${item.progress}%`;
  el('p', 'detail-note', '模拟项目，用于比较组件库的详情查看方式。', detailContent);
  const detail = mount('details', { title: libraryId === 'order' ? '侧边详情' : '项目详情', content: detailContent, triggerLabel: '预览详情' }, detailCell);
  detail.element.classList.add('catalog-details'); detail.trigger.prepend(createIcon(document, 'rows', library.icon));
  const detailDescription = el('p', 'catalog-detail-description', `${library.interaction}，内容保持一致。`, detail.element);
  detail.element.insertBefore(detailDescription, detail.panel);
  const accordionCell = el('section', 'interactive-sample', '', interactions);
  el('h3', '', libraryId === 'ease' ? '可同时展开多项' : '一次聚焦一项', accordionCell);
  mount('accordion', { items: [{ id: 'scope', label: '包含哪些内容？', content: '通用组件、颜色主题、亮暗模式与页面示例。' }, { id: 'usage', label: '适合什么场景？', content: `${library.fit.join('、')}。` }] }, accordionCell);
  const motionCell = el('section', 'interactive-sample', '', interactions);
  el('h3', '', `${library.icon === 'regular' ? '线性图标' : library.icon === 'fill' ? '实心图标' : '双色图标'} · ${library.motion}`, motionCell);
  mount('iconSet', {}, motionCell); mount('motion', { text: '内容更新完成' }, motionCell);
  el('p', 'catalog-note', '模拟业务演示 · 悬停与焦点列是对照样例，真实焦点由键盘或鼠标操作决定。操作仅保留在本页，刷新后重置。', catalog);
  return { element, destroy() { if (!alive) return; alive = false; controller.abort(); for (const timer of timers) document.defaultView.clearTimeout(timer); timers.clear(); for (const component of components.reverse()) component.destroy(); element.remove(); } };
}
