import { lifecycle } from './lifecycle.mjs';
import { mountButton } from './button.mjs';
import { createIcon } from './icon.mjs';
import { node, uniqueId } from './dom.mjs';

function frame(container, tag, className) {
  const document = container.ownerDocument;
  const element = node(document, tag, className);
  const life = lifecycle(element);
  container.append(element);
  return { document, element, life };
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }

function statistic(container, options = {}) {
  const { document, element, life } = frame(container, 'article', 'dpc-statistic');
  const label = node(document, 'span'), value = node(document, 'strong'), suffix = node(document, 'em'), note = node(document, 'small');
  element.append(label, value, note);
  let props = { label: '', value: '', suffix: '', note: '' };
  function update(patch = {}) {
    life.assertAlive(); props = { ...props, ...patch };
    label.textContent = props.label; value.textContent = String(props.value ?? ''); suffix.textContent = props.suffix; value.append(suffix); note.textContent = props.note;
  }
  update(options); return { element, update, destroy: () => life.destroy() };
}

function chart(container, options = {}) {
  const { document, element, life } = frame(container, 'section', 'dpc-chart');
  let props = { type: 'bar', title: '', data: [], unit: '', emptyLabel: '暂无数据', onSelect: null };
  let data = [];
  const svgNode = (tag, attrs) => {
    const item = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
    return item;
  };
  function update(patch = {}) {
    life.assertAlive(); const next = { ...props, ...patch };
    if (!['bar', 'line', 'donut'].includes(next.type)) throw new Error('未知图表类型');
    if (!Array.isArray(next.data)) throw new Error('图表数据必须是数组');
    if (next.data.some(item => !item || typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0)) throw new Error('图表仅支持非负有限数值');
    const nextData = next.data.map(item => ({ ...item, label: String(item.label ?? '') }));
    props = next; data = nextData;
    element.replaceChildren(); element.dataset.chartType = props.type;
    if (props.title) element.append(node(document, 'h3', '', props.title));
    if (!data.length) { element.append(node(document, 'p', 'dpc-field-hint', props.emptyLabel)); return; }
    const max = Math.max(1, ...data.map(item => item.value));
    const total = data.reduce((sum, item) => sum + item.value / max, 0);
    const label = item => `${item.label}：${item.value}${props.unit}`;
    const button = (item, index) => {
      const control = node(document, 'button', '', label(item)); control.type = 'button'; control.dataset.chartIndex = index;
      control.setAttribute('aria-label', label(item)); return control;
    };
    if (props.type === 'bar') {
      const bars = node(document, 'div', 'dpc-bar-chart'); bars.setAttribute('role', 'group'); bars.setAttribute('aria-label', props.title || '柱状图');
      data.forEach((item, index) => {
        const control = button(item, index); const bar = node(document, 'span', 'dpc-bar'); bar.style.height = `${item.value / max * 110}px`;
        control.replaceChildren(node(document, 'span', 'dpc-bar-value', item.value), bar, node(document, 'small', '', item.label)); bars.append(control);
      }); element.append(bars);
    } else if (props.type === 'line') {
      const svg = svgNode('svg', { class: 'dpc-line-chart', viewBox: '0 0 300 140', role: 'img', 'aria-label': `${props.title || '折线图'}：${data.map(label).join('；')}` });
      svg.append(svgNode('line', { x1: 20, y1: 110, x2: 280, y2: 110, stroke: 'var(--line)' }), svgNode('line', { x1: 20, y1: 70, x2: 280, y2: 70, stroke: 'var(--line)', 'stroke-dasharray': '3 5' }));
      const coordinates = data.map((item, index) => [data.length === 1 ? 150 : 20 + index * 260 / (data.length - 1), 110 - item.value / max * 80]);
      svg.append(svgNode('polyline', { points: coordinates.map(point => point.join(',')).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3 }));
      coordinates.forEach(([x, y]) => svg.append(svgNode('circle', { cx: x, cy: y, r: 4, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 2 })));
      element.append(svg);
    } else {
      const wrap = node(document, 'div', 'dpc-donut-wrap'), ring = node(document, 'div', 'dpc-donut');
      const colors = ['var(--accent)', 'var(--muted)', 'var(--line)']; let start = 0;
      const stops = data.map((item, index) => { const end = start + (total ? (item.value / max) / total * 100 : 0); const stop = `${colors[index % 3]} ${start}% ${end}%`; start = end; return stop; });
      ring.style.background = total ? `conic-gradient(${stops.join(',')})` : 'var(--line)';
      ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', data.map(label).join('；'));
      const middle = node(document, 'span', '', props.centerLabel || '合计'); middle.append(node(document, 'strong', '', props.centerValue ?? `${data.length} 类`)); ring.append(middle);
      const legend = node(document, 'ul', 'dpc-chart-legend');
      data.forEach((item, index) => { const row = node(document, 'li'); const dot = node(document, 'i'); dot.style.background = colors[index % 3]; row.append(dot, node(document, 'span', '', item.label), node(document, 'b', '', `${item.value}${props.unit}`)); legend.append(row); });
      wrap.append(ring, legend); element.append(wrap);
    }
  }
  element.addEventListener('click', event => {
    const button = event.target.closest('[data-chart-index]');
    if (button && element.contains(button)) { const index = Number(button.dataset.chartIndex); props.onSelect?.({ ...data[index] }, index); }
  }, { signal: life.signal });
  try { update(options); } catch (error) { life.destroy(); throw error; }
  return { element, update, destroy: () => life.destroy() };
}

function progress(container, options = {}) {
  const { document, element, life } = frame(container, 'label', 'dpc-progress');
  const label = node(document, 'span'), control = node(document, 'progress'); element.append(label, control);
  let props = { label: '', value: 0, max: 100 };
  function update(patch = {}) {
    life.assertAlive(); props = { ...props, ...patch }; const max = finite(props.max) > 0 ? props.max : 100, value = Math.min(max, Math.max(0, finite(props.value)));
    label.textContent = props.label || `${value === max ? '已完成' : value === 0 ? '等待开始' : '进行中'} · ${Math.round(value / max * 100)}%`;
    control.max = max; control.value = value; control.setAttribute('aria-label', label.textContent);
  }
  update(options); return { element, control, update, destroy: () => life.destroy() };
}

function tooltip(container, options = {}, library) {
  const { document, element, life } = frame(container, 'div', 'dpc-tooltip-wrap');
  const bubble = node(document, 'span', 'dpc-tooltip'); bubble.id = uniqueId(document, 'tooltip'); bubble.setAttribute('role', 'tooltip'); bubble.hidden = true;
  let props = { label: '查看提示', text: '' }, hovered = false, focused = false, dismissed = false;
  const handle = mountButton(element, { label: props.label, variant: 'secondary' }, library); const trigger = handle.element; trigger.setAttribute('aria-describedby', bubble.id); element.append(bubble);
  const sync = () => { bubble.hidden = dismissed || !(hovered || focused); };
  element.addEventListener('pointerenter', () => { hovered = true; dismissed = false; sync(); }, { signal: life.signal });
  element.addEventListener('pointerleave', () => { hovered = false; if (!focused) dismissed = false; sync(); }, { signal: life.signal });
  trigger.addEventListener('focus', () => { focused = true; dismissed = false; sync(); }, { signal: life.signal });
  trigger.addEventListener('blur', () => { focused = false; sync(); }, { signal: life.signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !bubble.hidden) { dismissed = true; sync(); } }, { signal: life.signal });
  function update(patch = {}) { life.assertAlive(); props = { ...props, ...patch }; handle.update({ label: props.label }); bubble.textContent = props.text; }
  update(options); return { element, trigger, bubble, update, destroy() { life.destroy(() => handle.destroy()); } };
}

function menu(container, options = {}, library) {
  const { document, element, life } = frame(container, 'div', 'dpc-action-menu');
  const panel = node(document, 'div'); panel.id = uniqueId(document, 'menu'); panel.setAttribute('role', 'menu'); panel.hidden = true;
  let props = { label: '更多操作', items: [], onSelect: null }, opened = false;
  const handle = mountButton(element, { label: props.label, variant: 'secondary', icon: 'caret-right', onPress: () => opened ? close() : open() }, library);
  const trigger = handle.element; trigger.setAttribute('aria-haspopup', 'menu'); trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false'); element.append(panel);
  const enabled = () => [...panel.querySelectorAll('button:not(:disabled)')];
  function open(last = false) { life.assertAlive(); opened = true; panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); const items = enabled(); (last ? items.at(-1) : items[0])?.focus(); }
  function close(restore = true) { life.assertAlive(); if (!opened) return; opened = false; panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (restore) trigger.focus(); }
  trigger.addEventListener('keydown', event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(event.key === 'ArrowUp'); } }, { signal: life.signal });
  panel.addEventListener('keydown', event => {
    const items = enabled(), index = items.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[next]?.focus(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'Tab') { close(); }
  }, { signal: life.signal });
  panel.addEventListener('click', event => {
    const target = event.target.closest('button[data-menu-index]'); if (!target || target.disabled || !opened) return;
    const index = Number(target.dataset.menuIndex), item = props.items[index]; close(); props.onSelect?.(item.value ?? item.id ?? index, { ...item }, index);
  }, { signal: life.signal });
  document.addEventListener('pointerdown', event => { if (opened && !element.contains(event.target)) close(false); }, { signal: life.signal });
  element.addEventListener('focusout', event => { if (opened && event.relatedTarget && !element.contains(event.relatedTarget)) close(false); }, { signal: life.signal });
  function update(patch = {}) {
    life.assertAlive(); const next = { ...props, ...patch }; if (!Array.isArray(next.items)) throw new Error('菜单选项必须是数组'); props = next;
    handle.update({ label: props.label }); panel.setAttribute('aria-label', props.label);
    if (Object.hasOwn(patch, 'items')) {
      const hadFocus = panel.contains(document.activeElement); panel.replaceChildren();
      props.items.forEach((item, index) => { const control = node(document, 'button', '', item.label); control.type = 'button'; control.setAttribute('role', 'menuitem'); control.tabIndex = -1; control.disabled = Boolean(item.disabled); control.dataset.menuIndex = index; panel.append(control); });
      if (opened && hadFocus) (enabled()[0] || trigger).focus();
    }
  }
  try { update(options); } catch (error) { life.destroy(() => handle.destroy()); throw error; }
  return { element, trigger, panel, update, open, close, get isOpen() { return opened; }, destroy() { life.destroy(() => { if (panel.contains(document.activeElement)) trigger.focus(); handle.destroy(); }); } };
}

function confirm(container, options = {}, library) {
  const { document, element, life } = frame(container, 'div', 'dpc-confirm');
  const panel = node(document, 'dialog', 'dpc-confirm-dialog'); panel.id = uniqueId(document, 'confirm');
  const title = node(document, 'h2'), description = node(document, 'p'), actions = node(document, 'div', 'dpc-detail-actions'); title.id = `${panel.id}-title`; description.id = `${panel.id}-description`;
  panel.setAttribute('aria-labelledby', title.id); panel.setAttribute('aria-describedby', description.id); panel.append(title, description, actions);
  let props = { triggerLabel: '操作确认', title: '确认操作', description: '', confirmLabel: '确认', cancelLabel: '取消' }, opened = false, previousFocus;
  const triggerHandle = mountButton(element, { label: props.triggerLabel, variant: 'secondary', onPress: () => open() }, library);
  const trigger = triggerHandle.element; trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false');
  const cancelHandle = mountButton(actions, { label: props.cancelLabel, variant: 'secondary', onPress: () => close('cancel') }, library);
  const acceptHandle = mountButton(actions, { label: props.confirmLabel, onPress: () => { if (opened) { close('confirm'); props.onConfirm?.(); } } }, library);
  element.append(panel);
  const restore = () => { const target = previousFocus?.isConnected ? previousFocus : trigger; if (target.isConnected) target.focus(); };
  function open() { life.assertAlive(); if (opened) return; previousFocus = document.activeElement; panel.showModal(); opened = true; trigger.setAttribute('aria-expanded', 'true'); cancelHandle.element.focus(); props.onOpenChange?.(true); }
  function closed(reason) { if (!opened) return; opened = false; trigger.setAttribute('aria-expanded', 'false'); restore(); props.onOpenChange?.(false); if (reason === 'cancel') props.onCancel?.(); }
  function close(reason = 'cancel') { life.assertAlive(); if (!opened) return; panel.close(); closed(reason); }
  panel.addEventListener('cancel', event => { event.preventDefault(); close('cancel'); }, { signal: life.signal });
  panel.addEventListener('close', () => { if (!panel.open) closed('cancel'); }, { signal: life.signal });
  function update(patch = {}) { life.assertAlive(); props = { ...props, ...patch }; title.textContent = props.title; description.textContent = props.description; triggerHandle.update({ label: props.triggerLabel }); acceptHandle.update({ label: props.confirmLabel }); cancelHandle.update({ label: props.cancelLabel }); }
  update(options);
  return { element, trigger, panel, update, open, close, get isOpen() { return opened; }, destroy() { life.destroy(() => { if (panel.open) panel.close(); if (opened) restore(); opened = false; triggerHandle.destroy(); cancelHandle.destroy(); acceptHandle.destroy(); }); } };
}

function alert(container, options = {}, library) {
  const { document, element, life } = frame(container, 'div', 'dpc-inline-alert');
  let props = { type: 'info', text: '' };
  function update(patch = {}) {
    life.assertAlive(); const next = { ...props, ...patch }; if (!['info', 'success', 'warning', 'error'].includes(next.type)) throw new Error('未知提示类型'); props = next;
    element.className = `dpc-inline-alert dpc-${props.type}`; element.setAttribute('role', props.type === 'error' ? 'alert' : 'status');
    element.replaceChildren(createIcon(document, props.type === 'success' ? 'check-circle' : props.type === 'info' ? 'rows' : 'warning', library.icon), node(document, 'span', '', props.text));
  }
  try { update(options); } catch (error) { life.destroy(); throw error; } return { element, update, destroy: () => life.destroy() };
}

function feedback(container, options = {}, library) {
  const { document, element, life } = frame(container, 'article', 'dpc-feedback-sample');
  let props = { state: 'normal', label: '', title: '', description: '', actionLabel: '', onRetry: null, onAction: null }, action;
  const defaults = { normal: ['正常', '内容已准备好', 'check-circle'], success: ['成功', '操作完成', 'check-circle'], loading: ['加载中', '正在加载内容', 'circle-notch'], skeleton: ['加载中', '正在加载内容', 'circle-notch'], empty: ['空内容', '暂无内容', 'folder'], error: ['失败', '暂时无法加载', 'warning'] };
  function update(patch = {}) {
    life.assertAlive(); const next = { ...props, ...patch }; if (!Object.hasOwn(defaults, next.state)) throw new Error('未知内容反馈状态'); props = next;
    const hadFocus = action?.element === document.activeElement; action?.destroy(); action = null; element.replaceChildren(); element.dataset.state = props.state;
    const [label, title, icon] = defaults[props.state]; element.className = `dpc-feedback-sample dpc-${props.state}`;
    element.setAttribute('aria-busy', String(['loading', 'skeleton'].includes(props.state)));
    element.append(node(document, 'span', 'dpc-state-label', props.label || label)); const heading = node(document, 'div', 'dpc-feedback-title');
    const glyph = createIcon(document, icon, library.icon); if (props.state === 'loading') { const spin = node(document, 'span', 'dpc-spin'); spin.append(glyph); heading.append(spin); } else if (props.state !== 'skeleton') heading.append(glyph);
    heading.append(node(document, 'span', '', props.title || title)); element.append(heading);
    if (props.description) element.append(node(document, 'p', '', props.description));
    if (['loading', 'skeleton'].includes(props.state)) { for (const short of [false, true]) { const bar = node(document, 'div', `dpc-skeleton${short ? ' dpc-short' : ''}`); bar.setAttribute('aria-hidden', 'true'); element.append(bar); } }
    const actionLabel = props.actionLabel || (props.state === 'error' && props.onRetry ? '重新尝试' : '');
    if (actionLabel) action = mountButton(element, { label: actionLabel, variant: props.state === 'normal' ? 'ghost' : 'secondary', onPress: () => { if (props.state === 'error' && props.onRetry) props.onRetry(); else props.onAction?.(); } }, library);
    if (hadFocus) { if (action) action.element.focus(); else { heading.tabIndex = -1; heading.focus(); } }
  }
  try { update(options); } catch (error) { life.destroy(); throw error; }
  return { element, update, destroy() { life.destroy(() => action?.destroy()); } };
}

function toast(container, options = {}, library) {
  const { document, element, life } = frame(container, 'div', 'dpc-toast');
  const text = node(document, 'span'); text.setAttribute('role', 'status'); element.append(text);
  let props = { text: '', duration: 3200, closable: true }, timer, opened = true;
  const closeHandle = mountButton(element, { label: '', ariaLabel: '关闭消息', icon: 'x', variant: 'ghost', onPress: () => close() }, library);
  const clear = () => { document.defaultView.clearTimeout(timer); timer = null; };
  function schedule() { clear(); if (opened && finite(props.duration) > 0) timer = document.defaultView.setTimeout(() => close(), props.duration); }
  function close() { life.assertAlive(); if (!opened) return; opened = false; clear(); element.hidden = true; props.onClose?.(); }
  function open() { life.assertAlive(); opened = true; element.hidden = false; schedule(); }
  function update(patch = {}) { life.assertAlive(); props = { ...props, ...patch }; text.textContent = props.text; closeHandle.element.hidden = !props.closable; schedule(); }
  update(options); return { element, update, open, close, get isOpen() { return opened; }, destroy() { life.destroy(() => { clear(); opened = false; closeHandle.destroy(); }); } };
}

function iconSet(container, options = {}, library) {
  const { document, element, life } = frame(container, 'div', 'dpc-icon-set');
  let props = { label: '图标风格样例', names: ['squares-four', 'folder', 'rows', 'check-circle', 'warning'] };
  function update(patch = {}) { life.assertAlive(); const next = { ...props, ...patch }; const icons = next.names.map(name => createIcon(document, name, library.icon)); props = next; element.setAttribute('role', 'img'); element.setAttribute('aria-label', props.label); element.replaceChildren(...icons); }
  try { update(options); } catch (error) { life.destroy(); throw error; } return { element, update, destroy: () => life.destroy() };
}

function motion(container, options = {}, library) {
  const { document, element, life } = frame(container, 'div', 'dpc-motion');
  const sample = node(document, 'div', 'dpc-motion-sample'); let props = { label: '重播动效', text: '内容更新完成', icon: 'check-circle' };
  const handle = mountButton(element, { label: props.label, variant: 'secondary', onPress: () => replay() }, library); element.append(sample);
  function replay() { life.assertAlive(); sample.classList.remove('dpc-play'); void sample.offsetWidth; sample.classList.add('dpc-play'); props.onReplay?.(); }
  function update(patch = {}) { life.assertAlive(); const next = { ...props, ...patch }; const icon = createIcon(document, next.icon, library.icon); props = next; handle.update({ label: props.label }); sample.replaceChildren(icon, node(document, 'span', '', props.text)); }
  update(options); return { element, sample, update, replay, destroy() { life.destroy(() => handle.destroy()); } };
}

export const feedbackFactories = { statistic, chart, progress, tooltip, menu, confirm, alert, feedback, toast, iconSet, motion };
