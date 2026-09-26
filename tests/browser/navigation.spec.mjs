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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setContent('<!doctype html><html lang="zh-CN"><body><main id="fixture" style="width:700px"></main></body></html>');
  await page.addStyleTag({ url: '/src/components/styles.css' });
});

test('页面导航和面包屑通知业务，禁用项不执行回调且文字更新保留焦点', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const calls = [];
    const items = [{ id: 'a', label: '首页' }, { id: 'b', label: '配置' }, { id: 'c', label: '不可用', disabled: true }];
    const nav = surface.pageNav({ items, onChange: id => calls.push(id) });
    const breadcrumb = surface.breadcrumb({ items: items.slice(0, 2), onChange: id => calls.push(`path:${id}`) });
    window.testCase = { surface, nav, breadcrumb, items, calls };
  });
  const nav = page.getByRole('navigation', { name: '页面导航', exact: true });
  await nav.getByRole('button', { name: '配置', exact: true }).click();
  await page.evaluate(() => testCase.nav.update({ items: testCase.items.map(item => ({ ...item, label: item.id === 'b' ? '新配置' : item.label })) }));
  await expect(nav.getByRole('button', { name: '新配置', exact: true })).toBeFocused();
  await expect(nav.getByRole('button', { name: '不可用', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: '面包屑', exact: true }).getByRole('button', { name: '首页', exact: true }).click();
  expect(await page.evaluate(() => testCase.calls)).toEqual(['b', 'path:a']);
  await nav.getByRole('button', { name: '新配置', exact: true }).focus();
  await page.evaluate(() => testCase.nav.update({ items: testCase.items.filter(item => item.id !== 'b') }));
  await expect(nav.getByRole('button', { name: '首页', exact: true })).toBeFocused();
  expect(await page.evaluate(() => testCase.nav.value)).toBe('a');
});

test('折叠内容更新保留正在填写的节点，收起时返回标题', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const content = document.createElement('input');
    content.setAttribute('aria-label', '配置名称');
    const accordion = surface.accordion({ items: [{ id: 'a', label: '配置详情', content }], expanded: ['a'] });
    window.testCase = { surface, accordion, content };
  });
  await page.getByRole('textbox', { name: '配置名称', exact: true }).fill('正在填写');
  await page.evaluate(() => testCase.accordion.update({ items: [{ id: 'a', label: '更新标题', content: testCase.content }] }));
  await expect(page.getByRole('textbox', { name: '配置名称', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: '配置名称', exact: true })).toHaveValue('正在填写');
  await page.evaluate(() => testCase.accordion.update({ expanded: [] }));
  await expect(page.getByRole('button', { name: '更新标题', exact: true })).toBeFocused();
});

test('页签跳过禁用项，键盘循环和 Home End 切换内容，关系标识互不冲突', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const items = [{ id: 'a', label: '概览', content: '概览正文' }, { id: 'b', label: '禁用', content: '不能选中', disabled: true }, { id: 'c', label: '记录', content: '记录正文' }];
    const changes = [];
    const first = surface.tabs({ items, onChange: id => changes.push(id) });
    const second = surface.tabs({ items });
    window.testCase = { surface, first, second, items, changes };
  });
  const first = page.locator('.dpc-tabs').first();
  await first.getByRole('tab', { name: '概览', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(first.getByRole('tab', { name: '记录', exact: true })).toBeFocused();
  await expect(first.getByRole('tabpanel', { name: '记录', exact: true })).toHaveText('记录正文');
  await page.keyboard.press('ArrowRight');
  await expect(first.getByRole('tab', { name: '概览', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  expect(await page.evaluate(() => testCase.changes)).toEqual(['c', 'a', 'c', 'a']);
  await page.evaluate(() => testCase.first.update({ items: testCase.items.map(item => ({ ...item, label: item.id === 'a' ? '新概览' : item.label })) }));
  await expect(first.getByRole('tab', { name: '新概览', exact: true })).toBeFocused();
  const result = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return { unique: new Set(ids).size === ids.length, connected: [...document.querySelectorAll('[role=tab]')].every(tab => document.getElementById(tab.getAttribute('aria-controls'))?.getAttribute('aria-labelledby') === tab.id), second: testCase.second.value };
  });
  expect(result).toEqual({ unique: true, connected: true, second: 'a' });
  await page.evaluate(() => testCase.first.update({ items: [{ id: 'c', label: '仅余记录', content: '记录正文' }] }));
  await expect(first.getByRole('tab', { name: '仅余记录', exact: true })).toBeFocused();
  expect(await page.evaluate(() => testCase.first.value)).toBe('c');
});

test('导航树支持展开、层级移动和选择，折叠保留选择且禁用节点跳过', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const changes = [], expansions = [];
    const tree = surface.tree({ items: [{ id: 'root', label: '工作空间', children: [{ id: 'off', label: '禁止选择', disabled: true }, { id: 'team', label: '产品团队', children: [{ id: 'member', label: '团队成员' }] }] }, { id: 'archive', label: '归档' }], onChange: id => changes.push(id), onExpand: ids => expansions.push(ids) });
    window.testCase = { surface, tree, changes, expansions };
  });
  await page.getByRole('treeitem', { name: '工作空间', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('treeitem', { name: '产品团队', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('treeitem', { name: '团队成员', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => ({ value: testCase.tree.value, expanded: testCase.tree.expanded, changes: testCase.changes }))).toEqual({ value: 'member', expanded: ['root'], changes: ['member'] });
  await page.keyboard.press('End');
  await expect(page.getByRole('treeitem', { name: '归档', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('treeitem', { name: '工作空间', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('treeitem', { name: '产品团队', exact: true })).toBeFocused();
  await page.keyboard.press(' ');
  expect(await page.evaluate(() => testCase.tree.value)).toBe('team');
  await page.evaluate(() => testCase.tree.update({ expanded: [] }));
  await expect(page.getByRole('treeitem', { name: '工作空间', exact: true })).toBeFocused();
});

test('步骤前后移动、结束回调和条目更新保留当前业务步骤', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const items = [{ id: 'source', label: '来源', content: '选择来源' }, { id: 'review', label: '检查', content: '检查内容' }];
    const calls = [];
    const steps = surface.steps({ items, onChange: index => calls.push(index), onComplete: item => calls.push(item.id) });
    window.testCase = { surface, items, steps, calls };
  });
  await expect(page.getByRole('button', { name: '上一步', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.evaluate(() => testCase.steps.update({ items: [{ id: 'intro', label: '说明' }, ...testCase.items] }));
  expect(await page.evaluate(() => testCase.steps.value)).toBe(2);
  await expect(page.getByRole('button', { name: '完成', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  expect(await page.evaluate(() => testCase.calls)).toEqual([1, 'review', 1]);
  await page.evaluate(() => testCase.steps.update({ disabled: true }));
  await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeDisabled();
});

for (const library of ['order', 'ease', 'edge']) {
  test(`${library}：折叠规则和 4 种外观保留选择、展开、焦点和节点`, async ({ page }) => {
    await page.evaluate(async library => {
      const { createSurface, libraries } = await import('/src/index.mjs');
      const surface = createSurface(document.querySelector('#fixture'), { library });
      const items = [{ id: 'a', label: '甲', content: '甲正文' }, { id: 'b', label: '乙', content: '乙正文' }, { id: 'off', label: '禁用标题', disabled: true }];
      const tabs = surface.tabs({ items, value: 'b' });
      const tree = surface.tree({ items: [{ id: 'root', label: '目录', children: [{ id: 'child', label: '子项' }] }], value: 'child', expanded: ['root'] });
      const accordion = surface.accordion({ items });
      window.testCase = { surface, tabs, tree, accordion, colors: libraries[library].colors.map(color => color.id), originalTabs: [...tabs.element.querySelectorAll('[role=tab]')], originalTree: [...tree.element.querySelectorAll('[role=treeitem]')] };
    }, library);
    const accordion = page.locator('.dpc-accordion');
    await accordion.getByRole('button', { name: '甲', exact: true }).click();
    await page.keyboard.press('ArrowDown');
    await expect(accordion.getByRole('button', { name: '乙', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    const expanded = library === 'ease' ? ['a', 'b'] : ['b'];
    expect(await page.evaluate(() => testCase.accordion.expanded)).toEqual(expanded);
    await page.keyboard.press('End');
    await expect(accordion.getByRole('button', { name: '乙', exact: true })).toBeFocused();
    const colors = await page.evaluate(() => testCase.colors);
    for (const color of colors) for (const mode of ['light', 'dark']) {
      const state = await page.evaluate(appearance => {
        testCase.surface.setAppearance(appearance);
        return { tabs: testCase.tabs.value, tree: testCase.tree.value, openTree: testCase.tree.expanded, openPanels: testCase.accordion.expanded, focus: document.activeElement.textContent, tabsRetained: testCase.originalTabs.every((node, index) => node === testCase.tabs.element.querySelectorAll('[role=tab]')[index]), treeRetained: testCase.originalTree.every((node, index) => node === testCase.tree.element.querySelectorAll('[role=treeitem]')[index]) };
      }, { color, mode });
      expect(state).toEqual({ tabs: 'b', tree: 'child', openTree: ['root'], openPanels: expanded, focus: '乙', tabsRetained: true, treeRetained: true });
    }
    await expect(accordion.getByRole('button', { name: '禁用标题', exact: true })).toBeDisabled();
    const validRelations = await page.evaluate(() => [...testCase.accordion.element.querySelectorAll('[aria-controls]')].every(button => document.getElementById(button.getAttribute('aria-controls'))?.getAttribute('aria-labelledby') === button.id));
    expect(validRelations).toBe(true);
  });
}

test('全部组件可独立显示安全业务文字，多实例隔离且卸载后旧节点无回调', async ({ page }) => {
  const text = '<img src=x onerror="window.unwanted=true">';
  await page.evaluate(async text => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const second = createSurface(document.querySelector('#fixture'));
    const calls = [];
    const items = [{ id: 'a', label: text, content: text }, { id: 'b', label: '乙', content: text }];
    const components = [surface.breadcrumb({ items, onChange: () => calls.push('breadcrumb') }), surface.pageNav({ items, onChange: () => calls.push('nav') }), surface.tabs({ items, onChange: () => calls.push('tabs') }), surface.tree({ items, onChange: () => calls.push('tree') }), surface.steps({ items, onChange: () => calls.push('steps') }), surface.accordion({ items, onChange: () => calls.push('accordion') }), surface.avatar({ label: text, text }), surface.badge({ label: text, value: text }), surface.timeline({ items })];
    const other = second.tabs({ items });
    window.testCase = { surface, second, components, calls, other };
  }, text);
  await expect(page.locator('#fixture img')).toHaveCount(0);
  const result = await page.evaluate(() => {
    const old = testCase.components.flatMap(component => [...component.element.querySelectorAll('button,[role=treeitem]')]);
    testCase.components[2].destroy();
    const otherStillConnected = testCase.other.element.isConnected;
    testCase.surface.destroy();
    for (const target of old) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    }
    const rejected = testCase.components.map(component => { try { component.update({}); return false; } catch { return true; } });
    return { calls: testCase.calls, rejected, otherStillConnected, otherValue: testCase.other.value, unwanted: Boolean(window.unwanted) };
  });
  expect(result).toEqual({ calls: [], rejected: Array(9).fill(true), otherStillConnected: true, otherValue: 'a', unwanted: false });
  await page.getByRole('tab', { name: '乙', exact: true }).click();
  expect(await page.evaluate(() => testCase.other.value)).toBe('b');
});

test('页签、头像、徽标、折叠标题与页面导航在12种外观下保持样稿关键样式', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reference = await context.newPage();
  await reference.emulateMedia({ reducedMotion: 'reduce' });
  await reference.setContent('<!doctype html><html lang="zh-CN"><body><main class="specimen" style="width:700px"><div class="demo-tabs"><button aria-selected="true">概览</button><button aria-selected="false">记录</button></div><span class="avatar">林</span><span class="notification-badge">待处理<b>7</b></span><section class="disclosure"><button aria-expanded="false">详情</button></section><section class="ease-top"><nav class="workspace-nav"><button aria-pressed="true">全部项目</button><button aria-pressed="false">归档</button></nav></section></main></body></html>');
  await reference.addStyleTag({ content: referenceCSS });
  const sample = selectors => selectors.map(selector => {
    const style = getComputedStyle(document.querySelector(selector));
    return Object.fromEntries(['display', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderTopWidth', 'borderBottomWidth', 'borderBottomColor', 'backgroundColor', 'color', 'gap', 'alignItems', 'justifyContent'].map(key => [key, style[key]]));
  });
  const referenceSelectors = ['.demo-tabs', '.demo-tabs button[aria-selected=true]', '.demo-tabs button[aria-selected=false]', '.avatar', '.notification-badge', '.notification-badge b', '.disclosure > button', '.workspace-nav', '.workspace-nav button[aria-pressed=true]', '.workspace-nav button[aria-pressed=false]'];
  const actualSelectors = ['.dpc-tab-list', '.dpc-tab[aria-selected=true]', '.dpc-tab[aria-selected=false]', '.dpc-avatar', '.dpc-notification-badge', '.dpc-notification-badge b', '.dpc-disclosure-trigger', '.dpc-page-nav', '.dpc-page-nav button[aria-current=page]', '.dpc-page-nav button:not([aria-current])'];
  for (const library of ['order', 'ease', 'edge']) {
    await page.evaluate(async library => {
      window.testCase?.surface?.destroy();
      const { createSurface } = await import('/src/index.mjs');
      const surface = createSurface(document.querySelector('#fixture'), { library });
      surface.tabs({ items: [{ id: 'a', label: '概览' }, { id: 'b', label: '记录' }] });
      surface.avatar({ label: '林' });
      surface.badge({ label: '待处理', value: 7 });
      surface.accordion({ items: [{ id: 'detail', label: '详情' }] });
      const nav = surface.pageNav({ items: [{ id: 'all', label: '全部项目', icon: 'squares-four' }, { id: 'archive', label: '归档', icon: 'folder' }] });
      window.testCase = { surface, nav, icons: [...nav.element.querySelectorAll('svg')] };
    }, library);
    for (const color of referenceLibraries[library].colors) for (const mode of ['light', 'dark']) {
      await page.evaluate(appearance => testCase.surface.setAppearance(appearance), { color: color.id, mode });
      await reference.evaluate(({ library, mode, palette }) => {
        const root = document.querySelector('.specimen');
        root.dataset.library = library;
        root.dataset.mode = mode;
        document.querySelector('.workspace-nav').parentElement.className = library === 'ease' ? 'ease-top' : '';
        for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--${key}`, value);
      }, { library, mode, palette: color[mode] });
      expect(await page.evaluate(sample, actualSelectors), `${library}/${color.id}/${mode}`).toEqual(await reference.evaluate(sample, referenceSelectors));
      await page.locator('.dpc-page-nav button').first().hover();
      await reference.locator('.workspace-nav button').first().hover();
      expect(await page.locator('.dpc-page-nav button').first().evaluate(element => getComputedStyle(element).backgroundColor)).toEqual(await reference.locator('.workspace-nav button').first().evaluate(element => getComputedStyle(element).backgroundColor));
      await page.mouse.move(1000, 800);
      await reference.mouse.move(1000, 800);
    }
    expect(await page.evaluate(() => testCase.icons.length === 2 && testCase.icons.every((icon, index) => icon === testCase.nav.element.querySelectorAll('svg')[index]))).toBe(true);
    await page.getByRole('button', { name: '归档', exact: true }).focus();
    await page.evaluate(() => testCase.nav.update({ items: [{ id: 'all', label: '全部项目', icon: 'squares-four' }, { id: 'archive', label: '归档更新', icon: 'folder' }] }));
    await expect(page.getByRole('button', { name: '归档更新', exact: true })).toBeFocused();
    expect(await page.evaluate(() => testCase.icons.every((icon, index) => icon === testCase.nav.element.querySelectorAll('svg')[index]))).toBe(true);
  }
  await reference.close();
});
