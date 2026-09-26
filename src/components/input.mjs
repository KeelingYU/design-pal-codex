import { lifecycle } from './lifecycle.mjs';

export function mountInput(container, options) {
  const document = container.ownerDocument;
  const element = document.createElement('div');
  element.className = 'dpc-field';
  const label = document.createElement('label');
  const control = document.createElement('input');
  control.type = 'text';
  control.className = 'dpc-input';
  control.id = `design-pal-codex-input-${document.defaultView.crypto.randomUUID()}`;
  label.htmlFor = control.id;
  const message = document.createElement('p');
  message.id = `${control.id}-message`;
  element.append(label, control, message);
  const life = lifecycle(element);
  let props = { label: '', value: '', hint: '', error: '', disabled: false, readOnly: false, placeholder: '' };

  function update(patch = {}) {
    life.assertAlive();
    const next = { ...props, ...patch };
    if (!String(next.label).trim()) throw new Error('输入框必须有标签');
    props = next;
    label.textContent = props.label;
    // 配色或提示变化不重新创建控件，也不覆盖用户刚输入的内容。
    if (Object.hasOwn(patch, 'value')) control.value = String(props.value);
    control.placeholder = props.placeholder;
    control.disabled = Boolean(props.disabled);
    control.readOnly = Boolean(props.readOnly);
    control.setAttribute('aria-invalid', String(Boolean(props.error)));
    message.className = `dpc-field-hint${props.error ? ' dpc-error' : ''}`;
    message.textContent = props.error || props.hint;
    if (props.error) message.setAttribute('role', 'alert');
    else message.removeAttribute('role');
    if (props.error || props.hint) control.setAttribute('aria-describedby', message.id);
    else control.removeAttribute('aria-describedby');
  }

  control.addEventListener('input', event => {
    if (props.disabled || props.readOnly) return;
    props.value = control.value;
    props.onInput?.(control.value, event);
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return { element, control, update, destroy() { life.destroy(); } };
}
