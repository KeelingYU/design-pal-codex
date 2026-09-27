import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPreviewState, writePreviewState } from '../../src/preview/preview-state.mjs';

test('详情地址固定库、配色、模式、页签和页面状态，刷新可恢复定位', () => {
  const state = readPreviewState('/preview.html?library=ease&color=sage&mode=dark&view=layout&scenario=error');
  assert.deepEqual({ ...state }, { library: 'ease', color: 'sage', mode: 'dark', view: 'layout', scenario: 'error', capture: false, section: '' });
  assert.deepEqual(readPreviewState(writePreviewState('/preview.html', state)), state);
});

test('无效库或跨库颜色不悄悄改用其他设计', () => {
  for (const query of ['library=missing', 'library=order&color=sage', 'mode=unknown', 'view=unknown', 'scenario=unknown']) assert.throws(() => readPreviewState('/preview.html?' + query));
});

test('组件锚点只在组件页保留，真实截图模式仍使用页面预览', () => {
  const state = readPreviewState('/preview.html?library=edge#buttons');
  assert.equal(writePreviewState('/preview.html', state).hash, '#buttons');
  assert.equal(writePreviewState('/preview.html', { ...state, view: 'info' }).hash, '');
  assert.equal(readPreviewState('/preview.html?capture=1').view, 'layout');
});
