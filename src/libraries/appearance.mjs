import { libraries } from './catalog.mjs';

export function resolveAppearance({ library = 'order', color, mode = 'light' } = {}) {
  if (!Object.hasOwn(libraries, library)) throw new Error('未知组件库');
  const definition = libraries[library];
  color ??= definition.colors[0].id;
  const theme = definition.colors.find(theme => theme.id === color);
  if (!theme || !['light', 'dark'].includes(mode)) throw new Error('未知配色或亮暗模式');
  return { library, color, mode, palette: { ...theme[mode] } };
}

export function paintAppearance(element, appearance) {
  element.dataset.library = appearance.library;
  element.dataset.color = appearance.color;
  element.dataset.mode = appearance.mode;
  for (const [key, value] of Object.entries(appearance.palette)) element.style.setProperty(`--${key}`, value);
}
