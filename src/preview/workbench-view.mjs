import { libraries } from '../libraries/catalog.mjs';
import { createIcon } from '../components/icon.mjs';
import { node } from '../components/dom.mjs';
import { projects } from './demo-data.mjs';

export function mountWorkbench(surface, container) {
  const document = container.ownerDocument;
  const library = surface.appearance.library;
  const element = node(document, 'div', `workbench ${library}-workspace`);
  element.dataset.pageLayout = libraries[library].layout;
  container.append(element);
  const handles = [], contentHandles = [];
  let query = '', filter = 'all', scenario = 'normal', selectedItem = 1, destroyed = false, inlineDetail;
  const icon = name => { const glyph = createIcon(document, name, libraries[library].icon); glyph.classList.add('icon'); return glyph; };
  const mount = (method, props, target, group = handles) => { const handle = surface[method](props, target); group.push(handle); return handle; };
  const detailContent = item => {
    const wrap = node(document, 'div', 'detail-content');
    wrap.append(node(document, 'p', 'detail-eyebrow', `项目详情 / ${String(item.id).padStart(2, '0')}`), node(document, 'h2', '', item.name), node(document, 'p', '', item.description));
    const list = node(document, 'dl');
    for (const [label, value] of [['负责人', item.owner], ['当前状态', item.status], ['项目类型', item.type], ['最近更新', item.date]]) {
      const pair = node(document, 'div'); pair.append(node(document, 'dt', '', label), node(document, 'dd', '', value)); list.append(pair);
    }
    const progress = node(document, 'div', 'progress'); const fill = node(document, 'span'); fill.style.width = `${item.progress}%`; progress.append(fill);
    progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', '完成进度'); progress.setAttribute('aria-valuenow', String(item.progress)); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
    wrap.append(list, node(document, 'p', 'detail-eyebrow', `完成进度 · ${item.progress}%`), progress, node(document, 'p', 'detail-note', '模拟项目，用于比较组件库的详情查看方式。'));
    return wrap;
  };
  const brand = node(document, library === 'edge' ? 'span' : 'div', library === 'edge' ? 'rail-brand' : 'workspace-name'); brand.append(icon('squares-four'));
  if (library !== 'edge') brand.append('工作空间');
  const navHost = node(document, library === 'ease' ? 'div' : 'aside', library === 'order' ? 'order-sidebar' : library === 'ease' ? 'ease-top' : 'edge-rail');
  navHost.append(brand); element.append(navHost);
  const navigation = mount('pageNav', {
    label: '项目筛选', value: filter,
    items: [{ id: 'all', label: '全部项目', icon: 'squares-four' }, { id: 'pending', label: '待处理', icon: 'rows' }, { id: 'ready', label: '已就绪', icon: 'check-circle' }],
    onChange(value) { filter = value; renderContent(); },
  }, navHost);
  navigation.element.classList.add('workspace-nav');
  for (const button of navigation.element.querySelectorAll('button')) { button.setAttribute('aria-label', button.textContent); button.title = button.textContent; }
  const main = library === 'ease' ? element : node(document, 'section', `${library}-main`);
  if (main !== element) element.append(main);
  const header = node(document, 'div', 'workspace-head'), heading = node(document, 'div');
  heading.append(node(document, 'h1', '', '项目管理'), node(document, 'p', '', '相同项目，不同的组织与操作方式。'));
  const search = node(document, 'div', 'search-box'); search.append(icon('magnifying-glass'));
  header.append(heading, search); main.append(header);
  const input = mount('input', { label: '搜索项目', value: query, placeholder: '搜索项目或负责人', onInput(value) { query = value; renderContent(); } }, search);
  const summary = node(document, 'div', 'work-summary');
  for (const [label, total] of [['项目总数 ', '03'], ['需要处理 ', '02']]) { const item = node(document, 'span', '', label); item.append(node(document, 'strong', '', total)); summary.append(item); }
  const count = node(document, 'span'); count.id = 'result-count'; count.setAttribute('aria-live', 'polite'); summary.append(count); main.append(summary);
  const content = node(document, 'div'); content.id = 'page-content'; main.append(content);
  let dialog;
  if (library !== 'edge') {
    dialog = mount('details', { title: library === 'order' ? '侧边详情' : '项目详情', content: detailContent(projects[0]) }, element);
    dialog.element.classList.add('workbench-detail-host'); dialog.trigger.hidden = true; dialog.panel.classList.add('workbench-dialog');
  }
  function visibleItems() {
    if (scenario !== 'normal') return [];
    return projects.filter(item => (filter === 'all' || (filter === 'ready' ? item.status === '已就绪' : item.status !== '已就绪')) && `${item.name} ${item.type} ${item.owner}`.includes(query.trim()));
  }
  function showDetail(item) {
    selectedItem = item.id;
    if (library === 'edge') {
      inlineDetail.update({ title: item.name, content: detailContent(item) });
      for (const button of content.querySelectorAll('[data-select-item]')) button.setAttribute('aria-pressed', String(Number(button.dataset.selectItem) === selectedItem));
    } else { dialog.update({ content: detailContent(item) }); dialog.open(); }
  }
  function restore() {
    query = ''; filter = 'all'; scenario = 'normal'; input.update({ value: '' }); navigation.update({ value: filter }); renderContent();
    element.dispatchEvent(new document.defaultView.CustomEvent('preview-scenario-change', { bubbles: true, detail: { scenario } }));
  }
  function renderFeedback() {
    const noMatch = scenario === 'normal';
    const title = noMatch ? '没有匹配的项目' : scenario === 'loading' ? '正在加载项目' : scenario === 'empty' ? '还没有项目' : '项目暂时无法加载';
    const feedback = mount('feedback', {
      state: noMatch ? 'empty' : scenario, title,
      description: scenario === 'loading' ? '保持加载状态供你检查。' : noMatch ? '换个关键词，或清除筛选。' : '当前为模拟状态，不会影响真实项目。',
      actionLabel: scenario === 'loading' ? '' : noMatch ? '清除筛选' : scenario === 'error' ? '重新加载' : '查看示例项目', onRetry: restore, onAction: restore,
    }, content, contentHandles);
    feedback.element.classList.add('page-feedback');
    const titleElement = feedback.element.querySelector('.dpc-feedback-title');
    titleElement.replaceWith(titleElement.firstElementChild, node(document, 'h2', '', title));
  }
  function renderContent() {
    for (const handle of contentHandles.splice(0)) handle.destroy();
    inlineDetail = undefined; content.replaceChildren();
    const list = visibleItems(); count.textContent = `当前显示 ${list.length} 项`;
    if (!list.length) { renderFeedback(); return; }
    if (library === 'order') {
      const wrap = node(document, 'div', 'table-wrap'), table = node(document, 'table', 'project-table');
      const head = node(document, 'thead'), headRow = node(document, 'tr');
      for (const label of ['项目', '状态', '负责人', '进度', '操作']) headRow.append(node(document, 'th', '', label));
      head.append(headRow); table.append(head); const body = node(document, 'tbody'); table.append(body); wrap.append(table); content.append(wrap);
      for (const item of list) {
        const row = node(document, 'tr'), title = node(document, 'div', 'project-title'), titleCell = node(document, 'td'), text = node(document, 'div', '', item.name);
        text.append(node(document, 'small', '', item.type)); title.append(icon('folder'), text); titleCell.append(title);
        const status = node(document, 'td'); status.append(node(document, 'span', 'tag', item.status));
        const progress = node(document, 'td'); const value = node(document, 'span', '', `${item.progress}%`); value.style.fontSize = '11px'; progress.append(value);
        const action = node(document, 'td'); row.append(titleCell, status, node(document, 'td', '', item.owner), progress, action); body.append(row);
        mount('button', { label: '查看详情', variant: 'secondary', ariaLabel: `查看${item.name}`, onPress: () => showDetail(item) }, action, contentHandles);
      }
    } else if (library === 'ease') {
      const cards = node(document, 'div', 'project-cards'); content.append(cards);
      for (const item of list) {
        const card = node(document, 'article', 'project-card'), top = node(document, 'div', 'card-top'); top.append(icon('folder'), node(document, 'span', 'tag', item.status));
        const footer = node(document, 'div', 'card-footer'); footer.append(node(document, 'span', '', item.owner));
        card.append(top, node(document, 'h2', '', item.name), node(document, 'p', '', item.description), footer); cards.append(card);
        const button = mount('button', { label: '打开项目', variant: 'ghost', ariaLabel: `查看${item.name}`, icon: 'caret-right', onPress: () => showDetail(item) }, footer, contentHandles);
        button.element.classList.add('workbench-open');
      }
    } else {
      const selected = list.find(item => item.id === selectedItem) || list[0];
      const split = node(document, 'div', 'edge-split'), rows = node(document, 'div', 'edge-list'), detail = node(document, 'section', 'edge-detail');
      rows.setAttribute('aria-label', '项目列表'); detail.setAttribute('aria-label', '就地项目详情'); detail.id = 'edge-detail'; split.append(rows, detail); content.append(split);
      for (const item of list) {
        const button = mount('button', { label: item.name, ariaLabel: `查看${item.name}`, variant: 'ghost', onPress: () => showDetail(item) }, rows, contentHandles);
        button.element.classList.add('workbench-item'); button.element.dataset.selectItem = item.id; button.element.setAttribute('aria-pressed', String(item.id === selected.id));
        const title = node(document, 'strong', '', item.name); title.append(icon('caret-right'));
        const status = node(document, 'small'); status.append(node(document, 'span', 'tag', item.status));
        button.element.replaceChildren(title, node(document, 'small', '', `${item.type} · ${item.owner}`), status);
      }
      inlineDetail = mount('details', { title: selected.name, content: detailContent(selected) }, detail, contentHandles);
      inlineDetail.element.classList.add('workbench-inline'); inlineDetail.trigger.hidden = true; inlineDetail.open();
    }
  }
  renderContent();
  return {
    element,
    setScenario(value) { if (destroyed) throw new Error('页面已卸载'); if (!['normal', 'loading', 'empty', 'error'].includes(value)) throw new Error('未知页面状态'); scenario = value; renderContent(); },
    get state() { return { query, filter, scenario, selectedItem }; },
    destroy() { if (destroyed) return; destroyed = true; for (const handle of [...contentHandles, ...handles]) handle.destroy(); element.remove(); },
  };
}
