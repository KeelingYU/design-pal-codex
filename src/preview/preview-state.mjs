import { resolveAppearance } from '../libraries/appearance.mjs';

export function readPreviewState(value) {
  const url = new URL(value, 'http://localhost');
  const resolved = resolveAppearance({
    library: url.searchParams.get('library') || 'order',
    color: url.searchParams.get('color') || undefined,
    mode: url.searchParams.get('mode') || 'light',
  });
  const capture = url.searchParams.get('capture') === '1';
  const view = capture ? 'layout' : url.searchParams.get('view') || 'components';
  const scenario = url.searchParams.get('scenario') || 'normal';
  if (!['components', 'layout', 'info'].includes(view)) throw new Error('未知预览页面');
  if (!['normal', 'loading', 'empty', 'error'].includes(scenario)) throw new Error('未知页面状态');
  return { library: resolved.library, color: resolved.color, mode: resolved.mode, view, scenario, capture, section: decodeURIComponent(url.hash.slice(1)) };
}

export function writePreviewState(value, state) {
  const url = new URL(value, 'http://localhost');
  for (const key of ['library', 'color', 'mode', 'view']) url.searchParams.set(key, state[key]);
  if (state.scenario === 'normal') url.searchParams.delete('scenario');
  else url.searchParams.set('scenario', state.scenario);
  url.hash = state.view === 'components' ? state.section || '' : '';
  return url;
}
