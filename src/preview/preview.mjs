import { createSurface, libraries } from '../index.mjs';
import { node } from '../components/dom.mjs';
import { readPreviewState, writePreviewState } from './preview-state.mjs';
import { mountCatalog, catalogGroups } from './catalog-view.mjs';
import { mountWorkbench } from './workbench-view.mjs';

let state;
try { state = readPreviewState(location.href); }
catch (error) {
  const message = node(document, 'p', 'preview-error', `无法打开此预览：${error.message}。请返回首页选择组件库。`);
  message.setAttribute('role', 'alert'); document.getElementById('preview-host').append(message);
  document.getElementById('detail-sidebar').hidden = true;
}
if (state) start();

function start() {
  const library = libraries[state.library];
  const surface = createSurface(document.getElementById('preview-host'), state);
  surface.element.classList.add('specimen'); surface.element.id = 'preview-panel';
  surface.element.setAttribute('role', 'tabpanel'); surface.element.tabIndex = -1;
  document.body.classList.toggle('capture-mode', state.capture);
  document.getElementById('current-library').textContent = `${library.name} / ${library.subtitle}`;
  const parts = Object.fromEntries(['components', 'layout', 'info'].map(view => {
    const container = node(document, 'div', `preview-view preview-${view}`); container.dataset.previewView = view;
    container.hidden = view !== state.view; surface.element.append(container); return [view, container];
  }));
  const catalog = mountCatalog(surface, parts.components);
  const workbench = mountWorkbench(surface, parts.layout);
  workbench.setScenario(state.scenario);
  parts.info.append(makeInfo(library));
  const colors = document.getElementById('color-tabs');
  for (const theme of library.colors) {
    const button = node(document, 'button'); button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'preview-panel');
    button.dataset.colorChoice = theme.id;
    const dot = node(document, 'i'); dot.style.background = theme.light.accent; dot.setAttribute('aria-hidden', 'true');
    button.append(dot, document.createTextNode(theme.name)); colors.append(button);
  }
  const sidebar = document.getElementById('detail-sidebar');
  let observer;
  let explicitSection = state.section;
  function syncAddress() {
    history.replaceState(null, '', writePreviewState(location.href, { ...state, section: explicitSection }));
    const home = new URL('./index.html', location.href);
    for (const key of ['library', 'color', 'mode']) home.searchParams.set(key, state[key]);
    document.querySelector('.brand').href = home;
  }
  function paint() {
    surface.setAppearance({ color: state.color, mode: state.mode });
    for (const button of colors.children) {
      const active = button.dataset.colorChoice === state.color;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    }
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    syncAddress();
  }
  function selectSection(id, scroll = false) {
    if (!catalogGroups.some(group => group.id === id)) return;
    state.section = id;
    sidebar.querySelectorAll('[data-section]').forEach(button => {
      if (button.dataset.section === id) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
    if (scroll) { explicitSection = id; document.getElementById(id)?.scrollIntoView({ block: 'start' }); syncAddress(); }
  }
  function drawSidebar() {
    sidebar.replaceChildren(); sidebar.hidden = state.view === 'info';
    document.querySelector('.detail-shell').classList.toggle('no-sidebar', state.view === 'info');
    if (sidebar.hidden) return;
    const isCatalog = state.view === 'components';
    sidebar.append(node(document, 'p', '', isCatalog ? '组件分组' : '页面状态'));
    const nav = document.createElement('nav'); nav.setAttribute('aria-label', isCatalog ? '组件分组' : '页面状态'); sidebar.append(nav);
    const choices = isCatalog ? catalogGroups : [{ id: 'normal', label: '正常' }, { id: 'loading', label: '加载中' }, { id: 'empty', label: '空内容' }, { id: 'error', label: '失败' }];
    for (const item of choices) {
      const button = node(document, 'button', '', item.label); button.type = 'button';
      if (isCatalog) button.dataset.section = item.id;
      else { button.dataset.scenario = item.id; button.setAttribute('aria-pressed', String(state.scenario === item.id)); }
      nav.append(button);
    }
    if (isCatalog) selectSection(state.section || catalogGroups[0].id);
  }
  function chooseView(view, scroll = false) {
    state.view = view;
    if (view !== 'components') explicitSection = '';
    for (const [name, container] of Object.entries(parts)) container.hidden = name !== view;
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === view; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
    surface.element.setAttribute('aria-labelledby', `tab-${view}`);
    observer?.disconnect(); drawSidebar(); syncAddress();
    if (scroll) window.scrollTo(0, 0);
    if (view === 'components') {
      const sections = [...parts.components.querySelectorAll('.catalog-section')];
      observer = new IntersectionObserver(() => {
        // 交界处的零面积相交不能把高亮退回上一组；按工具栏下方的位置判断。
        const first = sections.find(section => section.getBoundingClientRect().bottom > 120);
        if (first) selectSection(first.id);
      }, { rootMargin: '-120px 0px -55% 0px' });
      sections.forEach(section => observer.observe(section));
    }
  }
  colors.addEventListener('click', event => {
    const button = event.target.closest('[data-color-choice]'); if (!button) return;
    state.color = button.dataset.colorChoice; paint();
  });
  document.querySelector('.mode-picker').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]'); if (!button) return;
    state.mode = button.dataset.mode; paint();
  });
  document.querySelector('.view-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-view]'); if (button) chooseView(button.dataset.view, true);
  });
  function keyboardTabs(event, values, current, change) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : (values.indexOf(current) + (event.key === 'ArrowRight' ? 1 : values.length - 1)) % values.length;
    change(values[next]);
  }
  colors.addEventListener('keydown', event => keyboardTabs(event, library.colors.map(color => color.id), state.color, color => {
    state.color = color; paint(); [...colors.children].find(button => button.dataset.colorChoice === color).focus();
  }));
  document.querySelector('.view-tabs').addEventListener('keydown', event => keyboardTabs(event, ['components', 'layout', 'info'], state.view, view => {
    chooseView(view, true); document.getElementById(`tab-${view}`).focus();
  }));
  sidebar.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.section) selectSection(button.dataset.section, true);
    else if (button.dataset.scenario) {
      state.scenario = button.dataset.scenario; workbench.setScenario(state.scenario);
      sidebar.querySelectorAll('[data-scenario]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.scenario === state.scenario)));
      syncAddress();
    }
  });
  // 页面内的重试可以恢复正常状态，侧栏与地址保持同一事实来源。
  parts.layout.addEventListener('preview-scenario-change', event => {
    state.scenario = event.detail.scenario; drawSidebar(); syncAddress();
  });
  const initialSection = state.section;
  paint(); chooseView(state.view);
  if (state.view === 'components' && initialSection) requestAnimationFrame(() => selectSection(initialSection, true));
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    observer?.disconnect(); catalog.destroy(); workbench.destroy(); surface.destroy();
  }, { once: true });
}

function makeInfo(library) {
  const article = node(document, 'article', 'guide-content');
  article.append(node(document, 'h1', '', `${library.name} · ${library.subtitle}`), node(document, 'p', '', library.description), node(document, 'h3', '', '适用产品类型'));
  const tags = node(document, 'div', 'product-type-tags'); library.fit.forEach(label => tags.append(node(document, 'span', '', label))); article.append(tags);
  article.append(node(document, 'h3', '', '不适合直接采用'), node(document, 'p', '', library.avoid));
  const table = document.createElement('table'); const body = document.createElement('tbody'); table.append(body);
  for (const [label, value] of [['组件形状', library.shape], ['交互', library.interaction], ['动效', library.motion], ['颜色主题', `${library.colors.map(color => color.name).join('、')}，各有亮色／暗色模式`]]) {
    const row = document.createElement('tr'); row.append(node(document, 'th', '', label), node(document, 'td', '', value)); body.append(row);
  }
  article.append(table, node(document, 'h3', '', '组件与页面范围'), node(document, 'p', '', '可比较表单、数据表格、导航、图表、弹层与反馈，以及同一组项目数据的不同页面组织方式。复杂编辑、地图和流程编排不在当前范围。'));
  article.append(node(document, 'h3', '', '使用边界'), node(document, 'p', '', '预览使用模拟业务数据，刷新会重置操作内容。对话接入、项目版本管理和跨项目验收尚未完成；当前预览不代表真实业务服务。'), node(document, 'h3', '', '试用说明'), node(document, 'p', '', '组件状态并列展示；颜色主题与亮暗模式只改变配色。库详情固定当前组件库，换库请返回首页。'));
  const credit = node(document, 'p', 'preview-credit', '图标使用 Phosphor Icons，许可与来源随代码保存。'); article.append(credit);
  return article;
}
