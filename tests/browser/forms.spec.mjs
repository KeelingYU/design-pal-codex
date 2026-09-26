import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const referenceDirectory = existsSync(new URL('../../docs/demo/preview.css', import.meta.url))
  ? new URL('../../docs/demo/', import.meta.url)
  : new URL('../../examples/preview/', import.meta.url);
const referenceCSS = await readFile(new URL('preview.css', referenceDirectory), 'utf8');
const { libraries: referenceLibraries } = createRequire(import.meta.url)(fileURLToPath(new URL('preview-model.js', referenceDirectory)));

const variants = ['toggle', 'segmented', 'select', 'checkboxGroup', 'radioGroup', 'number', 'slider', 'dateRange', 'textarea', 'filePicker'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setContent('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><main id="fixture" style="width:600px;max-width:100%"></main></body></html>');
  await page.addStyleTag({ url: '/src/components/styles.css' });
});

for (const kind of variants) test(`${kind} 可独立创建，禁用及卸载阻止回调`, async ({ page }) => {
  const result = await page.evaluate(async kind => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const calls = [];
    const component = surface[kind]({ label: '独立组件', options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }], onChange: value => calls.push(value), onInput: value => calls.push(value) });
    const controls = component.controls;
    const mounted = component.element.isConnected && controls.length > 0;
    component.update({ disabled: true });
    for (const control of controls) {
      control.dispatchEvent(new Event('change', { bubbles: true }));
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    component.update({ disabled: false });
    surface.destroy();
    for (const control of controls) {
      control.dispatchEvent(new Event('change', { bubbles: true }));
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    let rejected = false;
    try { component.update({ hint: '不能复活' }); } catch { rejected = true; }
    return { mounted, calls, rejected, connected: component.element.isConnected };
  }, kind);
  expect(result).toEqual({ mounted: true, calls: [], rejected: true, connected: false });
});

test('开关、分段、单选和多选支持键盘，禁用选项不执行业务且单选实例互不影响', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const calls = [];
    const options = [{ value: 'a', label: '甲' }, { value: 'blocked', label: '禁用', disabled: true }, { value: 'b', label: '乙' }];
    const toggle = surface.toggle({ label: '启用', onChange: value => calls.push(['toggle', value]) });
    const segmented = surface.segmented({ label: '分段', options, value: 'a', onChange: value => calls.push(['segment', value]) });
    const radio = surface.radioGroup({ label: '通知甲', options, value: 'a', onChange: value => calls.push(['radio', value]) });
    const other = surface.radioGroup({ label: '通知乙', options, value: 'a' });
    const checkbox = surface.checkboxGroup({ label: '权限', options, value: ['a'], onChange: value => calls.push(['checkbox', value]) });
    const select = surface.select({ label: '团队', options, value: 'a', onChange: value => calls.push(['select', value]) });
    window.forms = { surface, calls, toggle, segmented, radio, other, checkbox, select };
  });
  await page.getByRole('switch', { name: '启用', exact: true }).press('Space');
  await page.getByRole('group', { name: '分段', exact: true }).getByRole('button', { name: '甲', exact: true }).press('ArrowRight');
  await expect(page.getByRole('group', { name: '分段', exact: true }).getByRole('button', { name: '乙', exact: true })).toBeFocused();
  await page.getByRole('group', { name: '通知甲', exact: true }).getByRole('radio', { name: '甲', exact: true }).press('ArrowRight');
  await page.getByRole('group', { name: '权限', exact: true }).getByRole('checkbox', { name: '乙', exact: true }).press('Space');
  await page.getByLabel('团队', { exact: true }).selectOption('b');
  await expect(page.getByRole('group', { name: '通知乙', exact: true }).getByRole('radio', { name: '甲', exact: true })).toBeChecked();
  const result = await page.evaluate(() => {
    const before = forms.calls.length;
    for (const component of [forms.segmented, forms.radio, forms.checkbox]) {
      const disabled = component.controls[1];
      disabled.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      disabled.dispatchEvent(new Event('change', { bubbles: true }));
    }
    forms.select.control.selectedIndex = 1;
    forms.select.control.dispatchEvent(new Event('change', { bubbles: true }));
    return { before, after: forms.calls.length, calls: forms.calls, values: [forms.toggle.value, forms.segmented.value, forms.radio.value, forms.other.value, forms.checkbox.value, forms.select.value], names: [forms.radio.controls[0].name, forms.other.controls[0].name] };
  });
  expect(result.before).toBe(result.after);
  expect(result.calls).toEqual([['toggle', true], ['segment', 'b'], ['radio', 'b'], ['checkbox', ['a', 'b']], ['select', 'b']]);
  expect(result.values).toEqual([true, 'b', 'b', 'a', ['a', 'b'], 'b']);
  expect(result.names[0]).not.toBe(result.names[1]);
});

test('数字上下限、步长、日期先后及多行字数校验随用户修改更新', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const values = [];
    const number = surface.number({ label: '数量', min: 2, max: 10, step: 2, required: true, value: 4, onInput: value => values.push(value) });
    const date = surface.dateRange({ label: '期间', value: { start: '2026-09-20', end: '2026-09-27' } });
    const textarea = surface.textarea({ label: '备注', maxlength: 5 });
    const slider = surface.slider({ label: '进度', min: 0, max: 10, step: 2, value: 4, unit: '%' });
    window.forms = { surface, number, date, textarea, slider, values };
  });
  const number = page.getByLabel('数量', { exact: true });
  await number.fill('1');
  await expect(number).toHaveAccessibleDescription('不能小于 2');
  await number.fill('12');
  await expect(number).toHaveAccessibleDescription('不能大于 10');
  await number.fill('3');
  await expect(number).toHaveAccessibleDescription('请按 2 的步长填写');
  await number.fill('');
  await expect(number).toHaveAccessibleDescription('请填写此项');
  await number.fill('6');
  await expect(number).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('结束日期', { exact: true }).fill('2026-09-19');
  await expect(page.getByLabel('开始日期', { exact: true })).toHaveAccessibleDescription('结束日期不能早于开始日期');
  expect(await page.evaluate(() => forms.date.end.checkValidity())).toBe(false);
  await page.getByLabel('结束日期', { exact: true }).fill('2026-09-28');
  expect(await page.evaluate(() => forms.date.end.checkValidity())).toBe(true);
  await page.getByLabel('备注', { exact: true }).fill('12345678');
  await expect(page.getByLabel('备注', { exact: true })).toHaveValue('12345');
  await expect(page.locator('.dpc-form-output').filter({ hasText: '5 / 5' })).toBeVisible();
  await page.getByLabel('进度', { exact: true }).press('ArrowRight');
  expect(await page.evaluate(() => ({ values: forms.values, slider: forms.slider.value, dates: forms.date.value }))).toEqual({ values: [1, 12, 3, null, 6], slider: 6, dates: { start: '2026-09-20', end: '2026-09-28' } });
});

for (const library of ['order', 'ease', 'edge']) test(`${library} 四种外观保留所有表单状态、控件、焦点和选择范围`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async library => {
    const { createSurface, libraries } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'), { library });
    const choices = [{ value: 'x', label: '甲' }, { value: 'y', label: '乙' }];
    const components = {
      toggle: surface.toggle({ label: '开关', value: true }),
      segmented: surface.segmented({ label: '分段', options: choices, value: 'y' }),
      select: surface.select({ label: '下拉', options: choices, value: 'y' }),
      checkbox: surface.checkboxGroup({ label: '复选', options: choices, value: ['y'] }),
      radio: surface.radioGroup({ label: '单选', options: choices, value: 'y' }),
      number: surface.number({ label: '数字', value: 12 }),
      slider: surface.slider({ label: '滑杆', value: 25 }),
      date: surface.dateRange({ label: '日期', value: { start: '2026-09-20', end: '2026-09-21' } }),
      textarea: surface.textarea({ label: '文字', value: '旧内容' }),
      file: surface.filePicker({ label: '附件' }),
    };
    window.forms = { surface, components, colors: libraries[library].colors.map(color => color.id), nodes: Object.values(components).flatMap(component => component.controls) };
  }, library);
  await page.getByLabel('附件', { exact: true }).setInputFiles({ name: '仅测试.txt', mimeType: 'text/plain', buffer: Buffer.from('虚构测试') });
  await page.getByLabel('文字', { exact: true }).fill('用户正在编辑');
  const before = await page.evaluate(() => {
    forms.components.textarea.control.setSelectionRange(1, 4);
    return Object.fromEntries(Object.entries(forms.components).map(([key, component]) => [key, component.value]));
  });
  for (const color of await page.evaluate(() => forms.colors)) for (const mode of ['light', 'dark']) {
    const after = await page.evaluate(({ color, mode }) => {
      forms.surface.setAppearance({ color, mode });
      Object.values(forms.components).forEach(component => component.update({ hint: '新的提示' }));
      const controls = Object.values(forms.components).flatMap(component => component.controls);
      const text = forms.components.textarea.control;
      return { values: Object.fromEntries(Object.entries(forms.components).map(([key, component]) => [key, component.value])), same: controls.every((control, index) => control === forms.nodes[index]), focused: document.activeElement === text, selection: [text.selectionStart, text.selectionEnd] };
    }, { color, mode });
    expect(after).toEqual({ values: before, same: true, focused: true, selection: [1, 4] });
  }
});

test('文件选择仅列出文件名，移除清空原生选择，业务字符串不能成为 HTML', async ({ page }) => {
  const payload = '<img src=x onerror="window.executed=true">';
  await page.evaluate(async payload => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const calls = [];
    const file = surface.filePicker({ label: '本地文件', multiple: true, onChange: names => calls.push(names) });
    surface.select({ label: payload, options: [{ value: 'x', label: payload }], value: 'x', hint: payload });
    surface.checkboxGroup({ label: '安全文字', options: [{ value: 'x', label: payload }], value: ['x'] });
    window.forms = { surface, file, calls };
    window.FileReader = class { constructor() { throw new Error('禁止读取测试文件'); } };
    File.prototype.text = File.prototype.arrayBuffer = File.prototype.stream = () => { throw new Error('禁止读取测试文件'); };
    window.fetch = () => { throw new Error('禁止上传测试文件'); };
  }, payload);
  await page.getByLabel('本地文件', { exact: true }).setInputFiles([
    { name: '甲.txt', mimeType: 'text/plain', buffer: Buffer.from('虚构甲') },
    { name: '乙.txt', mimeType: 'text/plain', buffer: Buffer.from('虚构乙') },
  ]);
  await expect(page.getByText('甲.txt、乙.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '移除文件选择', exact: true }).click();
  expect(await page.evaluate(() => ({ names: forms.file.value, count: forms.file.control.files.length, calls: forms.calls, executed: Boolean(window.executed) }))).toEqual({ names: [], count: 0, calls: [['甲.txt', '乙.txt'], []], executed: false });
  await expect(page.locator('#fixture img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '移除文件选择', exact: true })).toBeDisabled();
});

for (const library of ['order', 'ease', 'edge']) test(`${library} 正式表单在四种外观下保持已确认样稿的关键样式`, async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reference = await context.newPage();
  await reference.emulateMedia({ reducedMotion: 'reduce' });
  await reference.setContent(`<!doctype html><html lang="zh-CN"><body><main class="specimen" style="width:600px">
    <div class="field"><label>团队</label><select class="input" data-probe="select"><option>产品团队</option><option>运营团队</option></select></div>
    <div class="field"><label>禁用下拉</label><select class="input" disabled data-probe="select-disabled"><option>暂不可选择</option></select></div>
    <div class="field"><label>备注</label><textarea class="input" rows="3" maxlength="180" data-probe="textarea">输入内容</textarea></div>
    <label class="toggle-label">开关<input type="checkbox" class="switch" data-probe="toggle"></label>
    <label class="toggle-label">已选开关<input type="checkbox" class="switch" checked data-probe="toggle-checked"></label>
    <label class="toggle-label">禁用开关<input type="checkbox" class="switch" checked disabled data-probe="toggle-disabled"></label>
    <fieldset class="option-field"><legend>权限</legend><label><input type="checkbox" data-probe="checkbox">查看</label><label><input type="checkbox" checked data-probe="checkbox-checked">编辑</label><label><input type="checkbox" checked disabled data-probe="checkbox-disabled">禁用</label></fieldset>
    <fieldset class="option-field"><legend>通知</legend><label><input type="radio" name="reference-radio" data-probe="radio">站内</label><label><input type="radio" name="reference-radio" checked data-probe="radio-checked">邮件</label><label><input type="radio" name="reference-radio" disabled data-probe="radio-disabled">禁用</label></fieldset>
    <div class="choice-group" data-probe="segmented"><button type="button" aria-pressed="true" data-probe="segment-selected">普通</button><button type="button" aria-pressed="false" data-probe="segment">高</button></div>
    <div class="field"><label>阈值</label><input class="range" type="range" min="0" max="100" value="40" data-probe="slider"></div>
  </main></body></html>`);
  await reference.addStyleTag({ content: referenceCSS });
  await page.evaluate(async library => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'), { library });
    const mark = (control, name) => { control.dataset.probe = name; };
    mark(surface.select({ label: '团队', options: [{ value: 'product', label: '产品团队' }, { value: 'operations', label: '运营团队' }], value: 'product' }).control, 'select');
    mark(surface.select({ label: '禁用下拉', options: [{ value: 'disabled', label: '暂不可选择' }], value: 'disabled', disabled: true }).control, 'select-disabled');
    mark(surface.textarea({ label: '备注', value: '输入内容', rows: 3, maxlength: 180 }).control, 'textarea');
    mark(surface.toggle({ label: '开关' }).control, 'toggle');
    mark(surface.toggle({ label: '已选开关', value: true }).control, 'toggle-checked');
    mark(surface.toggle({ label: '禁用开关', value: true, disabled: true }).control, 'toggle-disabled');
    const checkbox = surface.checkboxGroup({ label: '权限', options: [{ value: 'view', label: '查看' }, { value: 'edit', label: '编辑' }, { value: 'disabled', label: '禁用', disabled: true }], value: ['edit', 'disabled'] });
    checkbox.controls.forEach((control, index) => mark(control, ['checkbox', 'checkbox-checked', 'checkbox-disabled'][index]));
    const radio = surface.radioGroup({ label: '通知', options: [{ value: 'onsite', label: '站内' }, { value: 'mail', label: '邮件' }, { value: 'disabled', label: '禁用', disabled: true }], value: 'mail' });
    radio.controls.forEach((control, index) => mark(control, ['radio', 'radio-checked', 'radio-disabled'][index]));
    const segmented = surface.segmented({ label: '优先级', options: [{ value: 'normal', label: '普通' }, { value: 'high', label: '高' }], value: 'normal' });
    mark(segmented.controls[0].parentElement, 'segmented');
    segmented.controls.forEach((control, index) => mark(control, index ? 'segment' : 'segment-selected'));
    mark(surface.slider({ label: '阈值', min: 0, max: 100, value: 40 }).control, 'slider');
    window.forms = { surface };
  }, library);
  const sample = () => {
    const properties = ['width', 'height', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'backgroundColor', 'color', 'accentColor', 'opacity'];
    const styleOf = (element, pseudo) => {
      const style = getComputedStyle(element, pseudo);
      return Object.fromEntries(properties.map(key => [key, style[key]]));
    };
    return Object.fromEntries([...document.querySelectorAll('[data-probe]')].map(control => {
      const key = control.dataset.probe;
      const value = { control: styleOf(control) };
      if (key.startsWith('toggle')) {
        value.thumb = styleOf(control, '::after');
        value.thumbTransform = getComputedStyle(control, '::after').transform;
      }
      return [key, value];
    }));
  };
  try {
    for (const color of referenceLibraries[library].colors) for (const mode of ['light', 'dark']) {
      await page.evaluate(appearance => forms.surface.setAppearance(appearance), { color: color.id, mode });
      await reference.evaluate(({ library, mode, palette }) => {
        const root = document.querySelector('.specimen');
        root.dataset.library = library;
        root.dataset.mode = mode;
        for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--${key}`, value);
      }, { library, mode, palette: color[mode] });
      expect(await page.evaluate(sample), `${library}/${color.id}/${mode}`).toEqual(await reference.evaluate(sample));
    }
  } finally {
    await reference.close();
  }
});
