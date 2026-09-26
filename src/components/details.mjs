import { lifecycle } from './lifecycle.mjs';
import { mountButton } from './button.mjs';

export function mountDetails(container, options, library) {
  const document = container.ownerDocument;
  const element = document.createElement('section');
  element.className = 'dpc-details';
  const life = lifecycle(element);
  const inline = library.detail === 'inline';
  const panel = document.createElement(inline ? 'section' : 'dialog');
  panel.className = 'dpc-detail-panel';
  panel.dataset.detailStyle = library.detail;
  panel.id = `design-pal-codex-detail-${document.defaultView.crypto.randomUUID()}`;
  if (inline) { panel.hidden = true; panel.setAttribute('role', 'region'); }
  const title = document.createElement('h2');
  title.id = `${panel.id}-title`;
  panel.setAttribute('aria-labelledby', title.id);
  const description = document.createElement('p');
  const content = document.createElement('div');
  content.className = 'dpc-detail-content';
  let opened = false;
  let previousFocus;
  let props = { title: '', description: '', content: '', triggerLabel: '查看详情' };
  const triggerHandle = mountButton(element, { label: props.triggerLabel, onPress: () => open() }, library);
  const trigger = triggerHandle.element;
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');
  if (!inline) trigger.setAttribute('aria-haspopup', 'dialog');
  const closeHandle = mountButton(panel, { label: '', ariaLabel: '关闭详情', variant: 'secondary', icon: 'x', onPress: () => close() }, library);
  closeHandle.element.classList.add('dpc-detail-close');
  panel.append(title, description, content);
  const actions = document.createElement('div');
  actions.className = 'dpc-detail-actions';
  const returnHandle = mountButton(actions, { label: '返回预览', variant: 'secondary', onPress: () => close() }, library);
  panel.append(actions);
  element.append(panel);

  function changed(value) {
    if (opened === value) return;
    opened = value;
    trigger.setAttribute('aria-expanded', String(value));
    props.onOpenChange?.(value);
  }

  function restoreFocus() {
    const target = previousFocus?.isConnected ? previousFocus : trigger;
    if (target.isConnected) target.focus();
  }

  function open() {
    life.assertAlive();
    if (opened) return;
    previousFocus = document.activeElement;
    if (inline) panel.hidden = false;
    else panel.showModal();
    closeHandle.element.focus();
    changed(true);
  }

  function close() {
    life.assertAlive();
    if (!opened) return;
    if (inline) panel.hidden = true;
    else panel.close();
    changed(false);
    restoreFocus();
  }

  function update(patch = {}) {
    life.assertAlive();
    props = { ...props, ...patch };
    title.textContent = props.title;
    description.textContent = props.description;
    description.hidden = !props.description;
    triggerHandle.update({ label: props.triggerLabel });
    if (Object.hasOwn(patch, 'content')) {
      // 调用方可传可信 DOM 节点；字符串始终按文字处理。
      content.replaceChildren(props.content?.nodeType ? props.content : document.createTextNode(String(props.content ?? '')));
    }
  }

  panel.addEventListener('cancel', event => { event.preventDefault(); close(); }, { signal: life.signal });
  panel.addEventListener('close', () => {
    if (!panel.open && opened) { changed(false); restoreFocus(); }
  }, { signal: life.signal });
  if (inline) panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); close(); }
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return {
    element, trigger, panel, open, close, update,
    get isOpen() { return opened; },
    destroy() {
      life.destroy(() => {
        if (!inline && panel.open) panel.close();
        if (opened) restoreFocus();
        opened = false;
        triggerHandle.destroy(); closeHandle.destroy(); returnHandle.destroy();
      });
    },
  };
}
