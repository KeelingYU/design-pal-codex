import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const referenceDirectory = existsSync(new URL('../../docs/demo/preview.css', import.meta.url)) ? new URL('../../docs/demo/', import.meta.url) : new URL('../../examples/preview/', import.meta.url);
const referenceCSS = await readFile(new URL('preview.css', referenceDirectory), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setContent('<!doctype html><html lang="zh-CN"><body><main id="fixture" style="width:700px;padding-top:80px"></main></body></html>');
  await page.addStyleTag({ url: '/src/components/styles.css' });
  await page.addStyleTag({ url: '/src/components/feedback.css' });
  await page.evaluate(async () => {
    const { createSurface, libraries } = await import('/src/index.mjs');
    const { feedbackFactories } = await import('/src/components/feedback.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    window.fixture = { surface, libraries, createSurface, feedbackFactories, calls: [], handles: [] };
    window.mountFeedback = (type, props = {}, target = surface) => { const handle = feedbackFactories[type](target.element, props, libraries[target.appearance.library]); fixture.handles.push(handle); return handle; };
  });
});

test('图表由调用方更新周期，点击和键盘返回对应数值；空数组、全零和单点均有效', async ({ page }) => {
  await page.evaluate(() => {
    fixture.bar = mountFeedback('chart', { title: '每日处理量', data: [{ label: '周一', value: 12 }, { label: '周二', value: 20 }], unit: '条', onSelect: (item, index) => fixture.calls.push([item.label, item.value, index]) });
    fixture.line = mountFeedback('chart', { type: 'line', data: [{ label: '单点', value: 0 }] });
    fixture.donut = mountFeedback('chart', { type: 'donut', data: [{ label: '甲', value: 0 }, { label: '乙', value: 0 }] });
    fixture.progress = mountFeedback('progress', { value: 0 });
  });
  await page.getByRole('button', { name: '周一：12条', exact: true }).click();
  await page.getByRole('button', { name: '周二：20条', exact: true }).press('Enter');
  expect(await page.evaluate(() => fixture.calls)).toEqual([['周一', 12, 0], ['周二', 20, 1]]);
  await expect(page.locator('[data-chart-type=line] button, [data-chart-type=donut] button')).toHaveCount(0);
  await page.evaluate(() => {
    fixture.bar.update({ data: [{ label: '第一周', value: 90 }] });
    fixture.progress.update({ value: 100 });
  });
  await expect(page.getByRole('button', { name: '第一周：90条', exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '100');
  expect(await page.locator('#fixture').innerHTML()).not.toMatch(/NaN|Infinity/);
  const rejected = await page.evaluate(() => [null, undefined, '12', -1, NaN, Infinity].map(value => { try { fixture.bar.update({ data: [{ label: '无效值', value }] }); return false; } catch { return true; } }));
  expect(rejected).toEqual(Array(6).fill(true));
  await expect(page.getByRole('button', { name: '第一周：90条', exact: true })).toBeVisible();
  await page.evaluate(() => fixture.bar.update({ data: [] }));
  await expect(page.getByText('暂无数据', { exact: true })).toBeVisible();
  await page.evaluate(() => fixture.line.update({ data: [{ label: '甲', value: Number.MAX_VALUE }, { label: '乙', value: Number.MAX_VALUE }] }));
  expect(await page.locator('#fixture').innerHTML()).not.toMatch(/NaN|Infinity/);
});

test('提示支持悬停、真实焦点、退出键；多个菜单键盘操作独立且跳过禁用项', async ({ page }) => {
  await page.evaluate(() => {
    fixture.tooltip = mountFeedback('tooltip', { label: '提示入口', text: '提示正文' });
    for (const label of ['甲菜单', '乙菜单']) mountFeedback('menu', { label, items: [{ label: '复制', value: 'copy' }, { label: '管理', disabled: true }, { label: '导出', value: 'export' }], onSelect: value => fixture.calls.push(`${label}:${value}`) });
  });
  const tooltip = page.getByRole('tooltip');
  await page.getByRole('button', { name: '提示入口' }).hover(); await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape'); await expect(tooltip).toBeHidden();
  await page.getByRole('button', { name: '提示入口' }).focus(); await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape'); await expect(tooltip).toBeHidden();
  const trigger = page.getByRole('button', { name: '甲菜单' });
  await trigger.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: '复制' })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: '导出' })).toBeFocused();
  await page.keyboard.press('Home'); await expect(page.getByRole('menuitem', { name: '复制' })).toBeFocused();
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(trigger).toBeFocused(); expect(await page.evaluate(() => fixture.calls)).toEqual(['甲菜单:export']);
  await trigger.press('ArrowUp'); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: '乙菜单' }).press('Enter'); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => fixture.calls)).toEqual(['甲菜单:export', '乙菜单:copy']);
});

test('确认初始聚焦取消，取消不确认，重复确认事件只回调一次，关闭后恢复焦点', async ({ page }) => {
  await page.evaluate(() => { fixture.confirm = mountFeedback('confirm', { triggerLabel: '打开确认', title: '确认归档', onConfirm: () => fixture.calls.push('confirm'), onCancel: () => fixture.calls.push('cancel') }); });
  const trigger = page.getByRole('button', { name: '打开确认' });
  await trigger.click(); await expect(page.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => fixture.calls)).toEqual(['cancel']);
  await trigger.click();
  await page.evaluate(() => { const button = fixture.confirm.panel.querySelector('.dpc-primary'); button.click(); button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  expect(await page.evaluate(() => fixture.calls)).toEqual(['cancel', 'confirm']); await expect(trigger).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('反馈状态并列；重试只发起回调，消息独立关闭、到期并释放销毁后的计时器', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    for (const state of ['normal', 'loading', 'skeleton', 'empty', 'error']) fixture[state] = mountFeedback('feedback', { state, onRetry: () => fixture.calls.push('retry') });
    fixture.toastA = mountFeedback('toast', { text: '短消息', duration: 1000, onClose: () => fixture.calls.push('A') });
    fixture.toastB = mountFeedback('toast', { text: '长消息', duration: 5000, onClose: () => fixture.calls.push('B') });
    fixture.toastC = mountFeedback('toast', { text: '手动消息', duration: 0, onClose: () => fixture.calls.push('C') });
  });
  await page.getByRole('button', { name: '重新尝试', exact: true }).click();
  expect(await page.evaluate(() => fixture.calls)).toEqual(['retry']);
  await expect(page.locator('.dpc-feedback-sample[data-state="error"]')).toBeVisible();
  await expect(page.locator('.dpc-feedback-sample')).toHaveCount(5);
  await page.clock.fastForward(1001); await expect(page.getByText('短消息', { exact: true })).toBeHidden();
  await expect(page.getByText('长消息', { exact: true })).toBeVisible();
  await page.evaluate(() => fixture.toastB.destroy()); await page.clock.fastForward(6000);
  await page.getByText('手动消息', { exact: true }).locator('..').getByRole('button', { name: '关闭消息' }).click();
  expect(await page.evaluate(() => fixture.calls)).toEqual(['retry', 'A', 'C']);
});

test('所有业务文字按文字显示；销毁后旧节点无回调，弹窗退出顶层且拒绝复活', async ({ page }) => {
  const result = await page.evaluate(() => {
    const text = '<img src=x onerror="window.executed=true">';
    for (const type of ['statistic', 'tooltip', 'alert', 'feedback', 'toast', 'motion']) mountFeedback(type, { label: text, title: text, text, value: text, description: text, duration: 0 });
    fixture.menu = mountFeedback('menu', { label: '操作', items: [{ label: text }], onSelect: () => fixture.calls.push('menu') }); fixture.menu.open();
    const item = fixture.menu.panel.querySelector('button');
    fixture.confirm = mountFeedback('confirm', { title: text, onConfirm: () => fixture.calls.push('confirm') }); fixture.confirm.open();
    const accept = fixture.confirm.panel.querySelector('.dpc-primary');
    const unsafe = document.querySelectorAll('#fixture img').length;
    for (const handle of fixture.handles) handle.destroy();
    item.click(); accept.click(); fixture.confirm.trigger.click();
    const errors = [];
    for (const action of [() => fixture.menu.open(), () => fixture.confirm.open(), () => fixture.confirm.update({ title: '复活' })]) { try { action(); errors.push(false); } catch { errors.push(true); } }
    return { unsafe, executed: Boolean(window.executed), errors, modals: document.querySelectorAll(':modal').length, calls: fixture.calls, children: fixture.surface.element.children.length };
  });
  expect(result).toEqual({ unsafe: 0, executed: false, errors: [true, true, true], modals: 0, calls: [], children: 0 });
});

for (const library of ['order', 'ease', 'edge']) {
  test(`${library} 四种外观保留已打开确认、真实焦点及组件形状，配色和样稿一致`, async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reference = await context.newPage();
    await reference.setContent('<main class="specimen"><div class="feedback-sample"><div class="feedback-title">正在加载内容</div></div><div class="inline-alert">说明</div><div class="metric-grid"><article><span>指标</span><strong>123</strong></article></div></main>');
    await reference.addStyleTag({ content: referenceCSS });
    await page.evaluate(library => {
      fixture.surface.destroy(); fixture.surface = fixture.createSurface(document.querySelector('#fixture'), { library });
      fixture.feedback = mountFeedback('feedback', { state: 'loading' }, fixture.surface);
      fixture.alert = mountFeedback('alert', { text: '说明' }, fixture.surface);
      fixture.statistic = mountFeedback('statistic', { label: '指标', value: 123 }, fixture.surface);
      fixture.motion = mountFeedback('motion', {}, fixture.surface); fixture.motion.replay();
      fixture.icons = mountFeedback('iconSet', {}, fixture.surface);
      fixture.confirm = mountFeedback('confirm', { title: '保留状态' }, fixture.surface); fixture.confirm.open(); fixture.originalPanel = fixture.confirm.panel;
    }, library);
    const colors = await page.evaluate(() => fixture.libraries[fixture.surface.appearance.library].colors);
    const sample = (selectors) => selectors.map(selector => { const style = getComputedStyle(document.querySelector(selector)); return Object.fromEntries(['paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','backgroundColor','color','borderTopColor','borderLeftWidth','fontSize'].map(key => [key, style[key]])); });
    let initial;
    for (const color of colors) for (const mode of ['light', 'dark']) {
      await page.evaluate(({ color, mode }) => fixture.surface.setAppearance({ color, mode }), { color: color.id, mode });
      await reference.evaluate(({ library, palette }) => { const root = document.querySelector('.specimen'); root.dataset.library = library; for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--${key}`, value); }, { library, palette: color[mode] });
      expect(await page.evaluate(sample, ['.dpc-feedback-sample', '.dpc-inline-alert', '.dpc-statistic'])).toEqual(await reference.evaluate(sample, ['.feedback-sample', '.inline-alert', '.metric-grid article']));
      const actual = await page.evaluate(() => ({ same: fixture.originalPanel === fixture.confirm.panel, open: fixture.confirm.isOpen, focused: document.activeElement.textContent.trim(), shape: getComputedStyle(fixture.confirm.panel).borderRadius, icon: fixture.icons.element.innerHTML, animation: getComputedStyle(fixture.motion.sample).animationName }));
      expect(actual.same).toBe(true); expect(actual.open).toBe(true); expect(actual.focused).toBe('取消'); expect(actual.animation).toBe('none');
      if (!initial) initial = actual; else expect(actual).toEqual(initial);
    }
    await reference.close();
  });
}

test('正式区域管理组件：切色保留菜单选择，卸载一个区域退出弹层并停止消息计时，另一区域继续工作', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    fixture.second = fixture.createSurface(document.querySelector('#fixture'), { library: 'ease' });
    fixture.firstMenu = fixture.surface.menu({ label: '第一区域操作', items: [{ label: '第一项', value: 1 }, { label: '第二项', value: 2 }] });
    fixture.secondMenu = fixture.second.menu({ label: '第二区域操作', items: [{ label: '保留项', value: 3 }], onSelect: value => fixture.calls.push(value) });
    fixture.firstConfirm = fixture.surface.confirm({ title: '待卸载确认', onConfirm: () => fixture.calls.push('confirm') });
    fixture.firstToast = fixture.surface.toast({ text: '待卸载消息', duration: 1000, onClose: () => fixture.calls.push('expired') });
  });
  await page.getByRole('button', { name: '第一区域操作' }).press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.evaluate(() => fixture.surface.setAppearance({ mode: 'dark' }));
  await expect(page.getByRole('menuitem', { name: '第二项', exact: true })).toBeFocused();
  await expect(page.getByRole('menu')).toBeVisible();
  const result = await page.evaluate(() => {
    fixture.firstConfirm.open(); const button = fixture.firstConfirm.panel.querySelector('.dpc-primary');
    fixture.surface.destroy(); button.click();
    return { modals: document.querySelectorAll(':modal').length, connected: fixture.second.element.isConnected };
  });
  expect(result).toEqual({ modals: 0, connected: true });
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: '第二区域操作' }).press('Enter'); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => fixture.calls)).toEqual([3]);
});
