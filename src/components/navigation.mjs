import { lifecycle } from './lifecycle.mjs';
import { node, putContent, uniqueId } from './dom.mjs';
import { createIcon } from './icon.mjs';

function itemsOf(items = []) {
  const ids = new Set();
  function visit(list) {
    if (!Array.isArray(list)) throw new Error('组件条目必须为数组');
    return list.map(item => {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('条目需要不重复的非空 id');
      ids.add(item.id);
      return { ...item, ...(item.children ? { children: visit(item.children) } : {}) };
    });
  }
  return visit(items);
}

// 多种条目组件共享按标识更新，保留未移除控件的节点和焦点。
function reconcile(parent, records, items, create, paint) {
  const keep = new Set(items.map(item => item.id));
  for (const [id, record] of records) {
    if (!keep.has(id)) { record.element.remove(); records.delete(id); }
  }
  items.forEach((item, index) => {
    let record = records.get(item.id);
    if (!record) { record = create(item); records.set(item.id, record); }
    paint(record, item, index);
    if (parent.children[index] !== record.element) parent.insertBefore(record.element, parent.children[index] ?? null);
  });
}

function selected(items, value) {
  return items.some(item => item.id === value && !item.disabled) ? value : items.find(item => !item.disabled)?.id ?? null;
}
function control(document, className, text) {
  const element = node(document, 'button', className, text);
  element.type = 'button';
  return element;
}
function mountNavigation(container, options = {}, breadcrumb = false, library) {
  const document = container.ownerDocument;
  const element = node(document, 'nav', breadcrumb ? 'dpc-breadcrumb' : 'dpc-page-nav');
  const life = lifecycle(element);
  const records = new Map();
  let props = { items: [], label: breadcrumb ? '面包屑' : '页面导航' };
  let value = null;
  function update(patch = {}) {
    life.assertAlive();
    const next = { ...props, ...patch, items: itemsOf(patch.items ?? props.items) };
    const icons = new Map(next.items.filter(item => !breadcrumb && item.icon).map(item => [item.id, createIcon(document, item.icon, library.icon)]));
    const active = document.activeElement, focused = element.contains(active);
    value = selected(next.items, Object.hasOwn(patch, 'value') ? patch.value : value ?? (breadcrumb ? next.items.filter(item => !item.disabled).at(-1)?.id : null));
    props = next;
    element.setAttribute('aria-label', props.label);
    reconcile(element, records, props.items, item => {
      const button = control(document, 'dpc-nav-item');
      button.dataset.id = item.id;
      const glyph = node(document, 'span', 'dpc-nav-glyph');
      const label = node(document, 'span', 'dpc-nav-label');
      button.append(glyph, label);
      return { element: button, glyph, label, icon: undefined };
    }, (record, item) => {
      const button = record.element;
      record.label.textContent = item.label ?? '';
      if (record.icon !== item.icon) {
        record.glyph.replaceChildren(...(icons.has(item.id) ? [icons.get(item.id)] : []));
        record.icon = item.icon;
      }
      record.glyph.hidden = !icons.has(item.id);
      button.disabled = Boolean(props.disabled || item.disabled || (breadcrumb && item.id === value));
      if (item.id === value) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (focused && (!active.isConnected || active.disabled)) {
      (records.get(value)?.element.disabled ? [...records.values()].find(record => !record.element.disabled)?.element : records.get(value)?.element)?.focus();
    }
  }
  element.addEventListener('click', event => {
    const button = event.target.closest('button[data-id]');
    if (!button || !element.contains(button) || button.disabled) return;
    const item = props.items.find(item => item.id === button.dataset.id);
    value = item.id;
    update();
    props.onChange?.(value, item);
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return { element, get value() { return value; }, update, destroy() { life.destroy(); } };
}
function breadcrumb(container, options, library) { return mountNavigation(container, options, true, library); }
function pageNav(container, options, library) { return mountNavigation(container, options, false, library); }

function tabs(container, options = {}) {
  const document = container.ownerDocument;
  const element = node(document, 'div', 'dpc-tabs');
  const list = node(document, 'div', 'dpc-tab-list');
  list.setAttribute('role', 'tablist');
  const panels = node(document, 'div', 'dpc-tab-panels');
  element.append(list, panels);
  const life = lifecycle(element);
  const records = new Map();
  let props = { items: [], label: '内容页签' };
  let value = null;
  function update(patch = {}) {
    life.assertAlive();
    const next = { ...props, ...patch, items: itemsOf(patch.items ?? props.items) };
    value = selected(next.items, Object.hasOwn(patch, 'value') ? patch.value : value);
    props = next;
    const active = document.activeElement;
    const focusInside = list.contains(active);
    list.setAttribute('aria-label', props.label);
    for (const [id, record] of records) if (!props.items.some(item => item.id === id)) record.panel.remove();
    reconcile(list, records, props.items, item => {
      const button = control(document, 'dpc-tab');
      button.id = uniqueId(document, 'tab');
      button.dataset.id = item.id;
      button.setAttribute('role', 'tab');
      const panel = node(document, 'div', 'dpc-tab-panel');
      panel.id = uniqueId(document, 'tabpanel');
      panel.tabIndex = 0;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      button.setAttribute('aria-controls', panel.id);
      panels.append(panel);
      return { element: button, panel, content: undefined };
    }, (record, item) => {
      record.element.textContent = item.label ?? '';
      record.element.disabled = Boolean(props.disabled || item.disabled);
      record.element.tabIndex = item.id === value && !props.disabled ? 0 : -1;
      record.element.setAttribute('aria-selected', String(item.id === value));
      record.panel.hidden = item.id !== value;
      if (record.content !== item.content) { putContent(record.panel, item.content ?? ''); record.content = item.content; }
    });
    if (focusInside && (!active.isConnected || active.disabled)) records.get(value)?.element.focus();
  }
  function choose(id, focus = false) {
    if (props.disabled || props.items.find(item => item.id === id)?.disabled) return;
    const changed = value !== id;
    value = id;
    update();
    if (focus) records.get(value)?.element.focus();
    if (changed) props.onChange?.(value, props.items.find(item => item.id === value));
  }
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-id]');
    if (button && list.contains(button) && !button.disabled) choose(button.dataset.id);
  }, { signal: life.signal });
  list.addEventListener('keydown', event => {
    const button = event.target.closest('button[data-id]');
    if (!button || button.disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const enabled = props.items.filter(item => !item.disabled);
    const index = enabled.findIndex(item => item.id === button.dataset.id);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
    event.preventDefault();
    choose(enabled[next].id, true);
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return { element, get value() { return value; }, update, destroy() { life.destroy(); } };
}

function tree(container, options = {}, library) {
  const document = container.ownerDocument;
  const element = node(document, 'div', 'dpc-tree');
  element.setAttribute('role', 'tree');
  const life = lifecycle(element);
  const records = new Map();
  let props = { items: [], label: '导航树' };
  let flat = [], value = null, expanded = new Set(), focusId = null;
  function flatten(items, parent = null, depth = 1) {
    return items.flatMap(item => [{ ...item, parent, depth }, ...flatten(item.children ?? [], item.id, depth + 1)]);
  }
  function visible() {
    return flat.filter(item => {
      let parent = item.parent;
      while (parent) { if (!expanded.has(parent)) return false; parent = flat.find(entry => entry.id === parent)?.parent; }
      return !item.disabled;
    });
  }
  function paint() {
    const available = visible();
    if (!available.some(item => item.id === focusId)) {
      let ancestor = flat.find(item => item.id === focusId)?.parent;
      while (ancestor && !available.some(item => item.id === ancestor)) ancestor = flat.find(item => item.id === ancestor)?.parent;
      focusId = ancestor ?? (available.some(item => item.id === value) ? value : available[0]?.id ?? null);
    }
    for (const item of flat) {
      const record = records.get(item.id);
      record.element.tabIndex = item.id === focusId && !props.disabled ? 0 : -1;
      record.element.setAttribute('aria-selected', String(value === item.id));
      record.element.setAttribute('aria-disabled', String(Boolean(props.disabled || item.disabled)));
      if (item.children?.length) record.element.setAttribute('aria-expanded', String(expanded.has(item.id)));
      else record.element.removeAttribute('aria-expanded');
      record.group.hidden = !expanded.has(item.id) || !item.children?.length;
      record.caret.hidden = !item.children?.length;
    }
  }
  function update(patch = {}) {
    life.assertAlive();
    const next = { ...props, ...patch, items: itemsOf(patch.items ?? props.items) };
    const focused = element.contains(document.activeElement);
    props = next;
    flat = flatten(props.items);
    value = selected(flat, Object.hasOwn(patch, 'value') ? patch.value : value);
    if (Object.hasOwn(patch, 'expanded')) expanded = new Set(patch.expanded);
    expanded = new Set([...expanded].filter(id => flat.some(item => item.id === id && item.children?.length)));
    element.setAttribute('aria-label', props.label);
    for (const [id, record] of records) if (!flat.some(item => item.id === id)) { record.element.remove(); records.delete(id); }
    function render(items, target, depth) {
      items.forEach((item, index) => {
        let record = records.get(item.id);
        if (!record) {
          const entry = node(document, 'div', 'dpc-tree-item');
          entry.dataset.id = item.id;
          entry.setAttribute('role', 'treeitem');
          const row = node(document, 'div', 'dpc-tree-row');
          const caret = node(document, 'span', 'dpc-tree-caret');
          caret.append(createIcon(document, 'caret-right', library.icon));
          caret.dataset.toggle = 'true';
          caret.setAttribute('aria-hidden', 'true');
          const label = node(document, 'span');
          label.id = uniqueId(document, 'tree-label');
          entry.setAttribute('aria-labelledby', label.id);
          const group = node(document, 'div');
          group.setAttribute('role', 'group');
          row.append(caret, createIcon(document, 'folder', library.icon), label);
          entry.append(row, group);
          record = { element: entry, label, group, caret };
          records.set(item.id, record);
        }
        record.label.textContent = item.label ?? '';
        record.element.setAttribute('aria-level', String(depth));
        record.element.setAttribute('aria-posinset', String(index + 1));
        record.element.setAttribute('aria-setsize', String(items.length));
        if (target.children[index] !== record.element) target.insertBefore(record.element, target.children[index] ?? null);
        render(item.children ?? [], record.group, depth + 1);
      });
    }
    render(props.items, element, 1);
    paint();
    if (focused && (!element.contains(document.activeElement) || document.activeElement.closest('[hidden]') || document.activeElement.getAttribute('aria-disabled') === 'true')) records.get(focusId)?.element.focus();
  }
  function focus(id) { focusId = id; paint(); records.get(id)?.element.focus(); }
  function toggle(id) {
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    paint();
    props.onExpand?.([...expanded]);
  }
  function choose(id) {
    value = id;
    focus(id);
    props.onChange?.(value, flat.find(item => item.id === value));
  }
  element.addEventListener('click', event => {
    const target = event.target.closest('[role=treeitem]');
    if (!target || !element.contains(target) || target.getAttribute('aria-disabled') === 'true') return;
    const item = flat.find(item => item.id === target.dataset.id);
    focus(item.id);
    if (event.target.closest('[data-toggle]') && item.children?.length) toggle(item.id);
    else choose(item.id);
  }, { signal: life.signal });
  element.addEventListener('keydown', event => {
    const target = event.target.closest('[role=treeitem]');
    if (!target || target.getAttribute('aria-disabled') === 'true') return;
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' '];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const item = flat.find(item => item.id === target.dataset.id);
    const entries = visible(), index = entries.findIndex(entry => entry.id === item.id);
    if (event.key === 'ArrowDown') focus(entries[Math.min(index + 1, entries.length - 1)].id);
    if (event.key === 'ArrowUp') focus(entries[Math.max(index - 1, 0)].id);
    if (event.key === 'Home') focus(entries[0].id);
    if (event.key === 'End') focus(entries.at(-1).id);
    if (event.key === 'ArrowRight' && item.children?.length) {
      if (!expanded.has(item.id)) toggle(item.id);
      else { const child = entries.find(entry => entry.parent === item.id); if (child) focus(child.id); }
    }
    if (event.key === 'ArrowLeft') {
      if (expanded.has(item.id)) toggle(item.id);
      else if (item.parent && entries.some(entry => entry.id === item.parent)) focus(item.parent);
    }
    if (event.key === 'Enter' || event.key === ' ') choose(item.id);
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return { element, get value() { return value; }, get expanded() { return [...expanded]; }, update, destroy() { life.destroy(); } };
}

function steps(container, options = {}) {
  const document = container.ownerDocument;
  const element = node(document, 'section', 'dpc-stepper');
  const list = node(document, 'ol', 'dpc-steps');
  const content = node(document, 'div', 'dpc-step-content');
  content.setAttribute('aria-live', 'polite');
  const actions = node(document, 'div', 'dpc-step-actions');
  const previous = control(document, 'dpc-btn dpc-secondary');
  const next = control(document, 'dpc-btn');
  actions.append(previous, next);
  element.append(list, content, actions);
  const life = lifecycle(element), records = new Map();
  let props = { items: [], previousLabel: '上一步', nextLabel: '下一步', completeLabel: '完成' }, value = 0, currentContent;
  function update(patch = {}) {
    life.assertAlive();
    const nextProps = { ...props, ...patch, items: itemsOf(patch.items ?? props.items) };
    const oldId = props.items[value]?.id;
    let candidate = Object.hasOwn(patch, 'value') ? patch.value : nextProps.items.findIndex(item => item.id === oldId);
    if (Object.hasOwn(patch, 'value') && !Number.isInteger(candidate)) throw new Error('步骤位置必须为整数');
    value = Math.max(0, Math.min(candidate < 0 ? value : candidate, nextProps.items.length - 1));
    props = nextProps;
    reconcile(list, records, props.items, () => {
      const item = node(document, 'li');
      const mark = node(document, 'span');
      const label = node(document, 'span', 'dpc-step-label');
      item.append(mark, label);
      return { element: item, mark, label };
    }, (record, item, index) => {
      record.element.className = index === value ? 'dpc-current' : index < value ? 'dpc-completed' : '';
      if (index === value) record.element.setAttribute('aria-current', 'step'); else record.element.removeAttribute('aria-current');
      record.mark.textContent = index < value ? '✓' : String(index + 1);
      record.label.textContent = item.label ?? '';
    });
    const selectedContent = props.items[value]?.content ?? '';
    if (currentContent !== selectedContent) { putContent(content, selectedContent); currentContent = selectedContent; }
    previous.textContent = props.previousLabel;
    next.textContent = value === props.items.length - 1 ? props.completeLabel : props.nextLabel;
    previous.disabled = Boolean(props.disabled || value === 0 || !props.items.length);
    next.disabled = Boolean(props.disabled || !props.items.length);
  }
  element.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button === previous && !previous.disabled) { update({ value: value - 1 }); props.onChange?.(value, props.items[value]); }
    if (button === next && !next.disabled) {
      if (value === props.items.length - 1) props.onComplete?.(props.items[value]);
      else { update({ value: value + 1 }); props.onChange?.(value, props.items[value]); }
    }
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return { element, get value() { return value; }, update, destroy() { life.destroy(); } };
}

function accordion(container, options = {}, library) {
  const document = container.ownerDocument;
  const element = node(document, 'div', 'dpc-accordion');
  const life = lifecycle(element), records = new Map();
  const multiple = library.detail === 'modal';
  let props = { items: [] }, expanded = new Set();
  function update(patch = {}) {
    life.assertAlive();
    const next = { ...props, ...patch, items: itemsOf(patch.items ?? props.items) };
    props = next;
    if (Object.hasOwn(patch, 'expanded')) expanded = new Set(patch.expanded);
    expanded = new Set([...expanded].filter(id => props.items.some(item => item.id === id)));
    if (!multiple) expanded = new Set([...expanded].slice(0, 1));
    const active = document.activeElement, focused = element.contains(active);
    reconcile(element, records, props.items, item => {
      const section = node(document, 'section', 'dpc-disclosure');
      const heading = node(document, 'h3', 'dpc-disclosure-heading');
      const button = control(document, 'dpc-disclosure-trigger');
      const label = node(document, 'span');
      const caret = node(document, 'span', 'dpc-disclosure-caret');
      caret.append(createIcon(document, 'caret-right', library.icon));
      caret.setAttribute('aria-hidden', 'true');
      button.append(label, caret);
      button.id = uniqueId(document, 'accordion-trigger');
      button.dataset.id = item.id;
      const panel = node(document, 'div', 'dpc-disclosure-body');
      panel.id = uniqueId(document, 'accordion-panel');
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', button.id);
      button.setAttribute('aria-controls', panel.id);
      heading.append(button);
      section.append(heading, panel);
      return { element: section, button, label, panel, content: undefined };
    }, (record, item) => {
      record.label.textContent = item.label ?? '';
      record.button.disabled = Boolean(props.disabled || item.disabled);
      record.button.setAttribute('aria-expanded', String(expanded.has(item.id)));
      record.panel.hidden = !expanded.has(item.id);
      if (record.content !== item.content) { putContent(record.panel, item.content ?? ''); record.content = item.content; }
    });
    if (focused && (!active.isConnected || active.closest('[hidden]') || active.disabled)) {
      const containing = [...records.values()].find(record => record.element.contains(active) && !record.button.disabled);
      (containing ?? [...records.values()].find(record => !record.button.disabled))?.button.focus();
    }
  }
  element.addEventListener('click', event => {
    const button = event.target.closest('button[data-id]');
    if (!button || !element.contains(button) || button.disabled || records.get(button.dataset.id)?.button !== button) return;
    const id = button.dataset.id;
    if (expanded.has(id)) expanded.delete(id);
    else { if (!multiple) expanded.clear(); expanded.add(id); }
    update();
    props.onChange?.([...expanded]);
  }, { signal: life.signal });
  element.addEventListener('keydown', event => {
    const buttons = [...records.values()].map(record => record.button).filter(button => !button.disabled);
    const index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return { element, get expanded() { return [...expanded]; }, update, destroy() { life.destroy(); } };
}

function avatar(container, options = {}) {
  const document = container.ownerDocument;
  const element = node(document, 'span', 'dpc-avatar');
  const life = lifecycle(element);
  let props = { label: '', text: '' };
  function update(patch = {}) {
    life.assertAlive();
    props = { ...props, ...patch };
    element.textContent = props.text || Array.from(props.label).slice(0, 1).join('');
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', props.label || props.text || '头像');
    element.title = props.label;
  }
  update(options);
  container.append(element);
  return { element, update, destroy() { life.destroy(); } };
}
function badge(container, options = {}) {
  const document = container.ownerDocument;
  const element = node(document, 'span', 'dpc-notification-badge');
  const label = node(document, 'span'), value = node(document, 'b');
  element.append(label, value);
  const life = lifecycle(element);
  let props = { label: '', value: 0 };
  function update(patch = {}) {
    life.assertAlive();
    props = { ...props, ...patch };
    label.textContent = props.label;
    value.textContent = String(props.value);
  }
  update(options);
  container.append(element);
  return { element, update, destroy() { life.destroy(); } };
}
function timeline(container, options = {}) {
  const document = container.ownerDocument;
  const element = node(document, 'ol', 'dpc-timeline');
  const life = lifecycle(element), records = new Map();
  let props = { items: [], label: '时间线' };
  function update(patch = {}) {
    life.assertAlive();
    props = { ...props, ...patch, items: itemsOf(patch.items ?? props.items) };
    element.setAttribute('aria-label', props.label);
    reconcile(element, records, props.items, () => {
      const entry = node(document, 'li'), title = node(document, 'strong'), content = node(document, 'div');
      entry.append(title, content);
      return { element: entry, title, content, previous: undefined };
    }, (record, item) => {
      record.title.textContent = item.label ?? '';
      if (record.previous !== item.content) { putContent(record.content, item.content ?? ''); record.previous = item.content; }
    });
  }
  update(options);
  container.append(element);
  return { element, update, destroy() { life.destroy(); } };
}

export const navigationFactories = { breadcrumb, pageNav, tabs, tree, steps, accordion, avatar, badge, timeline };
