import test from 'node:test';
import assert from 'node:assert/strict';
import { GalleryState } from '../../src/preview/gallery-state.mjs';

test('首页保存各库配色与筛选，返回参数只覆盖当前库', () => {
  const first = new GalleryState();
  first.choose('order', 1);
  first.choose('ease', 1);
  first.setFilter('数据管理');
  const restored = new GalleryState(first.snapshot(), '?library=edge&color=amber');
  assert.equal(restored.color('order').id, 'slate');
  assert.equal(restored.color('ease').id, 'sage');
  assert.equal(restored.color('edge').id, 'amber');
  assert.equal(restored.filter, 'all');
  assert.equal(new GalleryState(first.snapshot()).filter, '数据管理');
});

test('无效记录和跨库颜色不能破坏首页状态', () => {
  for (const data of [null, [], 'bad', { positions: { order: 99 }, filter: '<script>' }]) {
    const state = new GalleryState(data, '?library=order&color=sage');
    assert.equal(state.color('order').id, 'indigo');
    assert.equal(state.filter, 'all');
  }
  const state = new GalleryState();
  state.choose('__proto__', 1);
  state.choose('order', -1);
  state.move('order', -1);
  assert.equal(state.color('order').id, 'slate');
  state.move('order', 1);
  assert.equal(state.color('order').id, 'indigo');
});

test('筛选不重置其他卡片，减少动态效果默认暂停但允许手动播放', () => {
  const state = new GalleryState(null, '', true);
  assert.equal(state.paused.size, 3);
  state.choose('ease', 1);
  state.setFilter('数据管理');
  assert.deepEqual(state.visibleLibraries().map(([key]) => key), ['order']);
  state.setFilter('all');
  assert.equal(state.color('ease').id, 'sage');
  state.toggleRotation('ease');
  assert.equal(state.paused.has('ease'), false);
});
