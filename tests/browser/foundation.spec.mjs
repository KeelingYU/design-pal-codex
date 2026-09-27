import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const referenceDirectory = existsSync(new URL('../../docs/demo/preview.css', import.meta.url))
  ? new URL('../../docs/demo/', import.meta.url)
  : new URL('../../examples/preview/', import.meta.url);
const { libraries: referenceLibraries } = require(fileURLToPath(new URL('preview-model.js', referenceDirectory)));
const referenceCSS = await readFile(new URL('preview.css', referenceDirectory), 'utf8');
const libraryIds = ['order', 'ease', 'edge'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setContent('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><main id="fixture" style="width:700px;max-width:100%"></main></body></html>');
  await page.addStyleTag({ url: '/src/components/styles.css' });
});

test('两个区域的挂载、更新和卸载互不影响，并保留宿主原有内容', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const host = document.querySelector('#fixture');
    const existing = document.createElement('p');
    existing.textContent = '宿主原有内容';
    host.append(existing);
    const first = createSurface(host, { library: 'order', color: 'indigo' });
    const second = createSurface(host, { library: 'ease', color: 'clay' });
    const calls = [];
    const firstButton = first.button({ label: '甲操作', onPress: () => calls.push('甲') });
    const secondButton = second.button({ label: '乙操作', onPress: () => calls.push('乙') });
    const firstInput = first.input({ label: '甲输入', value: '甲初值' });
    const secondInput = second.input({ label: '乙输入', value: '乙初值' });
    window.testCase = { first, second, firstButton, secondButton, firstInput, secondInput, calls, existing };
  });
  await page.getByLabel('甲输入', { exact: true }).fill('甲修改');
  await page.getByRole('button', { name: '乙操作', exact: true }).click();
  await page.evaluate(() => {
    testCase.firstButton.update({ label: '甲更新操作' });
    testCase.firstInput.update({ hint: '仅更新提示' });
    testCase.first.setAppearance({ color: 'slate', mode: 'dark' });
  });
  await expect(page.getByLabel('甲输入', { exact: true })).toHaveValue('甲修改');
  await expect(page.getByLabel('乙输入', { exact: true })).toHaveValue('乙初值');
  await expect(page.getByRole('button', { name: '甲更新操作', exact: true })).toBeVisible();
  expect(await page.evaluate(() => testCase.second.appearance)).toEqual({ library: 'ease', color: 'clay', mode: 'light' });
  await page.evaluate(() => { testCase.first.destroy(); testCase.first.destroy(); });
  await expect(page.getByRole('button', { name: '甲更新操作', exact: true })).toHaveCount(0);
  await expect(page.getByText('宿主原有内容', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '乙操作', exact: true }).click();
  expect(await page.evaluate(() => testCase.calls)).toEqual(['乙', '乙']);
  expect(await page.evaluate(() => testCase.existing.isConnected)).toBe(true);
});

test('禁用与加载按钮不会执行业务，恢复可用后支持鼠标和键盘操作', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const calls = [];
    const disabled = surface.button({ label: '禁用操作', disabled: true, onPress: () => calls.push('禁用') });
    const loading = surface.button({ label: '等待完成', loading: true, onPress: () => calls.push('加载') });
    window.testCase = { surface, disabled, loading, calls };
  });
  await expect(page.getByRole('button', { name: '禁用操作', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '等待完成', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '等待完成', exact: true })).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => {
    for (const component of [testCase.disabled, testCase.loading]) {
      component.element.click();
      component.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  expect(await page.evaluate(() => testCase.calls)).toEqual([]);
  await page.evaluate(() => {
    testCase.disabled.update({ disabled: false });
    testCase.loading.update({ loading: false });
  });
  await page.getByRole('button', { name: '禁用操作', exact: true }).click();
  await page.getByRole('button', { name: '等待完成', exact: true }).focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => testCase.calls)).toEqual(['禁用', '加载']);
});

for (const library of libraryIds) {
  test(`${referenceLibraries[library].name}：切换四种外观保留输入、真实焦点、尺寸、图标和详情状态`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(async library => {
      const { createSurface } = await import('/src/index.mjs');
      const surface = createSurface(document.querySelector('#fixture'), { library });
      const button = surface.button({ label: '执行操作', icon: 'plus' });
      const detail = surface.details({ title: '项目详情', content: '保留详情上下文' });
      const input = surface.input({ label: '详情输入', value: '初值' }, detail.panel);
      window.testCase = { surface, button, input, detail, originalControl: input.control, originalButton: button.element, originalPanel: detail.panel };
    }, library);
    await page.getByRole('button', { name: '查看详情', exact: true }).click();
    await page.getByLabel('详情输入', { exact: true }).fill('用户正在编辑的内容');
    await page.getByLabel('详情输入', { exact: true }).focus();
    await page.evaluate(() => testCase.input.control.setSelectionRange(2, 5));
    const measurements = [];
    for (const color of referenceLibraries[library].colors) {
      for (const mode of ['light', 'dark']) {
        await page.evaluate(appearance => testCase.surface.setAppearance(appearance), { color: color.id, mode });
        measurements.push(await page.evaluate(() => {
          const { surface, button, input, detail } = testCase;
          const geometry = element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return { width: rect.width, height: rect.height, radius: style.borderRadius, fontSize: style.fontSize, fontFamily: style.fontFamily, padding: style.padding };
          };
          return {
            appearance: surface.appearance,
            button: geometry(button.element), input: geometry(input.control), panel: geometry(detail.panel),
            icon: button.element.querySelector('svg').innerHTML,
            buttonColor: getComputedStyle(button.element).backgroundColor,
            inputColor: getComputedStyle(input.control).backgroundColor,
            sameNodes: input.control === testCase.originalControl && button.element === testCase.originalButton && detail.panel === testCase.originalPanel,
            focused: document.activeElement === input.control,
            selection: [input.control.selectionStart, input.control.selectionEnd],
            value: input.control.value, open: detail.isOpen,
          };
        }));
      }
    }
    expect(new Set(measurements.map(item => item.buttonColor)).size).toBe(4);
    expect(new Set(measurements.map(item => item.inputColor)).size).toBeGreaterThan(1);
    for (const result of measurements) {
      expect(result.button).toEqual(measurements[0].button);
      expect(result.input).toEqual(measurements[0].input);
      expect(result.panel).toEqual(measurements[0].panel);
      expect(result.icon).toEqual(measurements[0].icon);
      expect(result.sameNodes).toBe(true);
      expect(result.focused).toBe(true);
      expect(result.selection).toEqual([2, 5]);
      expect(result.value).toBe('用户正在编辑的内容');
      expect(result.open).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '查看详情', exact: true })).toBeFocused();
    expect(await page.evaluate(() => testCase.detail.isOpen)).toBe(false);
  });

  test(`${referenceLibraries[library].name}：详情沿用对应展示方式，关闭和退出键均恢复焦点`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(async library => {
      const { createSurface } = await import('/src/index.mjs');
      const surface = createSurface(document.querySelector('#fixture'), { library });
      const changes = [];
      const detail = surface.details({ title: '验收详情', description: '说明文字', content: '业务内容', onOpenChange: value => changes.push(value) });
      window.testCase = { surface, detail, changes };
    }, library);
    const trigger = page.getByRole('button', { name: '查看详情', exact: true });
    await trigger.click();
    await expect(page.getByRole(library === 'edge' ? 'region' : 'dialog', { name: '验收详情', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '关闭详情', exact: true })).toBeFocused();
    const layout = await page.evaluate(() => {
      const panel = testCase.detail.panel;
      const rect = panel.getBoundingClientRect();
      return { modal: panel.matches(':modal'), tag: panel.tagName, left: rect.left, right: rect.right, top: rect.top, height: rect.height, width: innerWidth, viewportHeight: innerHeight };
    });
    if (library === 'order') {
      expect(layout.modal).toBe(true);
      expect(layout.right).toBeCloseTo(layout.width, 0);
      expect(layout.top).toBeCloseTo(0, 0);
      expect(layout.height).toBeCloseTo(layout.viewportHeight, 0);
    } else if (library === 'ease') {
      expect(layout.modal).toBe(true);
      expect(layout.left).toBeCloseTo(layout.width - layout.right, 0);
      expect(layout.top).toBeGreaterThan(0);
    } else {
      expect(layout.modal).toBe(false);
      expect(layout.tag).not.toBe('DIALOG');
    }
    await page.getByRole('button', { name: '关闭详情', exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.press('Enter');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => testCase.changes)).toEqual([true, false, true, false]);
  });

  test(`${referenceLibraries[library].name}：正式按钮和输入在全部外观下保持已确认样稿的尺寸与配色`, async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const referencePage = await context.newPage();
    await referencePage.emulateMedia({ reducedMotion: 'reduce' });
    await referencePage.setContent('<!doctype html><html lang="zh-CN"><body><main class="specimen" style="width:700px"><button class="btn">执行操作</button><button class="btn secondary">辅助操作</button><button class="btn ghost">文字操作</button><div class="field"><label>输入名称</label><input class="input" value="测试内容"></div></main></body></html>');
    await referencePage.addStyleTag({ content: referenceCSS });
    await page.evaluate(async library => {
      const { createSurface } = await import('/src/index.mjs');
      const surface = createSurface(document.querySelector('#fixture'), { library });
      surface.button({ label: '执行操作' });
      surface.button({ label: '辅助操作', variant: 'secondary' });
      surface.button({ label: '文字操作', variant: 'ghost' });
      surface.input({ label: '输入名称', value: '测试内容' });
      window.testCase = { surface };
    }, library);
    const sampleStyles = ({ buttonSelector, inputSelector }) => [...document.querySelectorAll(buttonSelector), document.querySelector(inputSelector)].map(element => {
      const style = getComputedStyle(element);
      return Object.fromEntries(['width', 'height', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderTopWidth', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'backgroundColor', 'color', 'borderTopColor'].map(key => [key, style[key]]));
    });
    for (const color of referenceLibraries[library].colors) {
      for (const mode of ['light', 'dark']) {
        await page.evaluate(appearance => testCase.surface.setAppearance(appearance), { color: color.id, mode });
        await referencePage.evaluate(({ library, mode, palette }) => {
          const root = document.querySelector('.specimen');
          root.dataset.library = library;
          root.dataset.mode = mode;
          for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--${key}`, value);
        }, { library, mode, palette: color[mode] });
        const expected = await referencePage.evaluate(sampleStyles, { buttonSelector: '.btn', inputSelector: '.input' });
        const actual = await page.evaluate(sampleStyles, { buttonSelector: '.dpc-btn', inputSelector: '.dpc-input' });
        expect(actual, `${library}/${color.id}/${mode}`).toEqual(expected);
      }
    }
    await referencePage.close();
  });
}

test('业务文字始终作为文字显示，输入标签、错误信息和只读状态可用', async ({ page }) => {
  const text = '<img src=x onerror="window.unwantedExecution=true">';
  await page.evaluate(async text => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'), { library: 'edge' });
    const values = [];
    const button = surface.button({ label: text });
    const input = surface.input({ label: '业务输入', value: text, hint: text, onInput: value => values.push(value) });
    const detail = surface.details({ title: text, description: text, content: text });
    window.testCase = { surface, button, input, detail, values };
  }, text);
  await expect(page.getByRole('button', { name: text, exact: true })).toBeVisible();
  await expect(page.getByLabel('业务输入', { exact: true })).toHaveValue(text);
  await page.getByLabel('业务输入', { exact: true }).fill('新的业务内容');
  expect(await page.evaluate(() => testCase.values)).toEqual(['新的业务内容']);
  await page.evaluate(text => testCase.input.update({ error: text, readOnly: true }), text);
  await expect(page.getByLabel('业务输入', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('业务输入', { exact: true })).toHaveAccessibleDescription(text);
  await expect(page.getByLabel('业务输入', { exact: true })).not.toBeEditable();
  await page.getByLabel('业务输入', { exact: true }).press('A');
  await expect(page.getByLabel('业务输入', { exact: true })).toHaveValue('新的业务内容');
  await page.getByRole('button', { name: '查看详情', exact: true }).click();
  await expect(page.getByRole('heading', { name: text, exact: true })).toBeVisible();
  await expect(page.locator('#fixture img')).toHaveCount(0);
  expect(await page.evaluate(() => window.unwantedExecution)).toBeUndefined();
});

test('组件单独卸载及区域卸载后旧节点不再执行回调，失效实例拒绝继续操作', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const host = document.querySelector('#fixture');
    const existing = document.createElement('button');
    existing.textContent = '宿主按钮';
    host.append(existing);
    const surface = createSurface(host);
    const calls = [];
    const button = surface.button({ label: '子按钮', onPress: () => calls.push('button') });
    const input = surface.input({ label: '子输入', onInput: () => calls.push('input') });
    const detail = surface.details({ title: '子详情', onOpenChange: value => calls.push(value) });
    const errors = [];
    const mustReject = action => { try { action(); errors.push(false); } catch { errors.push(true); } };
    button.destroy();
    button.destroy();
    button.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    mustReject(() => button.update({ label: '不可复活' }));
    const remainingWorks = input.element.isConnected && detail.element.isConnected;
    detail.open();
    calls.length = 0;
    surface.destroy();
    surface.destroy();
    input.control.dispatchEvent(new Event('input', { bubbles: true }));
    detail.trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    detail.panel.dispatchEvent(new Event('cancel', { cancelable: true }));
    mustReject(() => input.update({ value: '不可复活' }));
    mustReject(() => detail.update({ title: '不可复活' }));
    mustReject(() => detail.open());
    mustReject(() => detail.close());
    mustReject(() => surface.setAppearance({ mode: 'dark' }));
    mustReject(() => surface.button({ label: '不可新增' }));
    mustReject(() => surface.input({ label: '不可新增' }));
    mustReject(() => surface.details({ title: '不可新增' }));
    return { calls, errors, remainingWorks, children: [...host.children].map(node => node.textContent), modalCount: document.querySelectorAll(':modal').length, connected: [surface.element, button.element, input.element, detail.element].some(node => node.isConnected) };
  });
  expect(result.calls).toEqual([]);
  expect(result.errors).toEqual(Array(9).fill(true));
  expect(result.remainingWorks).toBe(true);
  expect(result.children).toEqual(['宿主按钮']);
  expect(result.modalCount).toBe(0);
  expect(result.connected).toBe(false);
});

test('换库与无效配色被拒绝且不改变已显示的区域', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'), { library: 'order', color: 'indigo' });
    const button = surface.button({ label: '原操作' });
    const errors = [];
    for (const patch of [{ library: 'ease' }, { color: 'clay' }, { mode: 'invalid' }]) {
      try { surface.setAppearance(patch); errors.push(false); } catch { errors.push(true); }
    }
    return { errors, appearance: surface.appearance, retained: button.element.isConnected };
  });
  expect(result).toEqual({ errors: [true, true, true], appearance: { library: 'order', color: 'indigo', mode: 'light' }, retained: true });
});

test('减少动态效果偏好会停止加载和详情动画，且组件样式不改变宿主按钮', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const host = document.querySelector('#fixture');
    const outside = document.createElement('button');
    outside.textContent = '宿主按钮';
    host.append(outside);
    const sample = element => {
      const style = getComputedStyle(element);
      return { radius: style.borderRadius, size: style.fontSize, background: style.backgroundColor, color: style.color };
    };
    const sheets = [...document.styleSheets];
    for (const sheet of sheets) sheet.disabled = true;
    const before = sample(outside);
    for (const sheet of sheets) sheet.disabled = false;
    const states = [];
    for (const library of ['order', 'ease', 'edge']) {
      const surface = createSurface(host, { library });
      const button = surface.button({ label: '加载状态', loading: true });
      const detail = surface.details({ title: '动态详情' });
      detail.open();
      states.push(...[button.element, ...button.element.querySelectorAll('*'), detail.panel].map(element => ({ animation: getComputedStyle(element).animationName, duration: getComputedStyle(element).transitionDuration })));
      detail.close();
    }
    return { before, after: sample(outside), states };
  });
  expect(result.after).toEqual(result.before);
  for (const state of result.states) {
    expect(state.animation).toBe('none');
    expect(state.duration.split(',').every(value => Number.parseFloat(value) === 0)).toBe(true);
  }
});

test('基础验证页在三个窗口宽度完整启动，六个示例独立保存且没有页面错误或横向溢出', async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 1024, 820]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/src/preview/foundation.html');
    await expect(page.getByRole('heading', { name: '把确认的设计，变成可复用的组件。', exact: true })).toBeVisible();
    await expect(page.locator('.library-section')).toHaveCount(3);
    await expect(page.locator('.instance')).toHaveCount(6);
    for (const library of libraryIds) {
      await expect(page.locator(`.dpc-root[data-library="${library}"]`)).toHaveCount(2);
    }
    const first = page.locator('.instance').nth(0);
    const second = page.locator('.instance').nth(1);
    await first.getByLabel('项目名称', { exact: true }).fill(`窗口 ${width} 的编辑内容`);
    await first.getByRole('button', { name: '保存示例', exact: true }).click();
    await expect(first.getByRole('status')).toHaveText(`已保存“窗口 ${width} 的编辑内容”的演示状态，操作 1 次。`);
    await expect(second.getByLabel('项目名称', { exact: true })).toHaveValue('设计示例 2');
    await expect(second.getByRole('status')).toHaveText('模拟操作，不会写入真实项目。');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `窗口 ${width} 不应横向溢出`).toBe(true);
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('基础验证页.png'), fullPage: true });
  }
  expect(pageErrors).toEqual([]);
});
