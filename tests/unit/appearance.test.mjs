import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { libraries, colorKeys } from '../../src/libraries/catalog.mjs';
import { resolveAppearance } from '../../src/libraries/appearance.mjs';
const require = createRequire(import.meta.url);
const baseline = require(existsSync(new URL('../../docs/demo/preview-model.js', import.meta.url))
  ? '../../docs/demo/preview-model.js' : '../../examples/preview/preview-model.js');

test('正式库的全部规则与12组配色保留已确认样稿', () => {
  assert.deepEqual(libraries, baseline.libraries);
  let count = 0;
  for (const [library, value] of Object.entries(libraries)) for (const color of value.colors) for (const mode of ['light', 'dark']) {
    const appearance = resolveAppearance({ library, color: color.id, mode });
    assert.deepEqual(Object.keys(appearance.palette), colorKeys);
    assert.deepEqual(appearance.palette, color[mode]);
    count++;
  }
  assert.equal(count, 12);
});

test('不支持的库、跨库配色与无效模式明确拒绝', () => {
  for (const options of [{ library: 'missing' }, { library: '__proto__' }, { library: 'order', color: 'clay' }, { mode: 'auto' }]) {
    assert.throws(() => resolveAppearance(options), /未知/);
  }
  assert.equal(resolveAppearance({ library: 'ease' }).color, 'clay');
});

test('调用方改动返回的颜色不会污染其他项目的库配色', () => {
  const first = resolveAppearance();
  const color = first.palette.accent;
  first.palette.accent = '#000000';
  assert.equal(resolveAppearance().palette.accent, color);
});
