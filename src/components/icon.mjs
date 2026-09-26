import { icons } from '../libraries/icons.mjs';

export function createIcon(document, name, style) {
  if (!Object.hasOwn(icons, style) || !Object.hasOwn(icons[style], name)) throw new Error('未知图标');
  // 仅解析随包提供的固定 SVG，不接受用户提供的 HTML。
  const template = document.createElement('template');
  template.innerHTML = icons[style][name];
  const svg = template.content.firstElementChild;
  svg.classList.add('dpc-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}
