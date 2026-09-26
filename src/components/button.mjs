import { lifecycle } from './lifecycle.mjs';
import { createIcon } from './icon.mjs';

export function mountButton(container, options, library) {
  const document = container.ownerDocument;
  const element = document.createElement('button');
  element.type = 'button';
  const label = document.createElement('span');
  const glyph = document.createElement('span');
  glyph.className = 'dpc-button-glyph';
  element.append(glyph, label);
  const life = lifecycle(element);
  let props = { label: '', variant: 'primary', disabled: false, loading: false };

  function update(patch = {}) {
    life.assertAlive();
    const next = { ...props, ...patch };
    if (!['primary', 'secondary', 'ghost'].includes(next.variant)) throw new Error('未知按钮类型');
    if (!String(next.label).trim() && !String(next.ariaLabel ?? '').trim()) throw new Error('按钮必须有可读名称');
    const icon = next.loading ? 'circle-notch' : next.icon;
    const svg = icon ? createIcon(document, icon, library.icon) : null;
    props = next;
    element.className = `dpc-btn dpc-${props.variant}${props.loading ? ' dpc-loading' : ''}${!props.label ? ' dpc-icon-btn' : ''}`;
    element.disabled = Boolean(props.disabled || props.loading);
    element.setAttribute('aria-busy', String(Boolean(props.loading)));
    if (props.ariaLabel) element.setAttribute('aria-label', props.ariaLabel);
    else element.removeAttribute('aria-label');
    label.textContent = props.label;
    label.hidden = !props.label;
    glyph.replaceChildren(...(svg ? [svg] : []));
    glyph.hidden = !svg;
    glyph.classList.toggle('dpc-spin', Boolean(props.loading));
  }

  element.addEventListener('click', event => {
    if (!props.disabled && !props.loading) props.onPress?.(event);
  }, { signal: life.signal });
  update(options);
  container.append(element);
  return { element, update, destroy() { life.destroy(); } };
}
