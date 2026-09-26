import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { libraries } from '../../src/libraries/catalog.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setContent('<!doctype html><html lang="zh-CN"><body><main id="fixture" style="max-width:900px"></main></body></html>');
  await page.addStyleTag({ url: '/src/components/styles.css' });
  await page.evaluate(async () => {
    const { createSurface } = await import('/src/index.mjs');
    const surface = createSurface(document.querySelector('#fixture'));
    const selections = []; const batches = [];
    const rows = [
      { id: 1, name: '项目甲', status: '进行中', owner: '演示甲', count: 20 },
      { id: 2, name: '项目乙', status: '已完成', owner: '演示乙', count: 60 },
      { id: 3, name: '项目丙', status: '进行中', owner: '演示乙', count: 10 },
      { id: 4, name: '项目丁', status: '已完成', owner: '演示甲', count: 40 },
      { id: 5, name: '项目戊', status: '进行中', owner: '演示甲', count: 30 },
    ];
    const props = {
      rows, pageSize: 2, pageSizes: [2, 3, 5],
      columns: [{ key: 'name', label: '项目', sortable: true, hideable: false }, { key: 'status', label: '状态' }, { key: 'owner', label: '负责人' }, { key: 'count', label: '记录数', sortable: true }],
      filters: [{ key: 'status', label: '按状态筛选', options: [{ value: '进行中', label: '进行中' }, { value: '已完成', label: '已完成' }] }, { key: 'owner', label: '按负责人筛选', options: [{ value: '演示甲', label: '演示甲' }, { value: '演示乙', label: '演示乙' }] }],
      batchActions: [{ id: 'mark', label: '批量标记' }],
      onSelectionChange(ids) { selections.push(ids); },
      onBatch(action, ids) { batches.push({ action, ids }); table.update({ marked: ids }); },
    };
    const table = surface.table(props);
    window.tableCase = { surface, table, props, rows, selections, batches };
  });
});

test('组合筛选与搜索保留输入焦点，空结果可恢复', async ({ page }) => {
  await page.getByRole('button', { name: '第 3 页', exact: true }).click();
  await page.getByLabel('按状态筛选').selectOption('进行中');
  await page.getByLabel('按负责人筛选').selectOption('演示乙');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('项目丙');
  await expect(page.getByRole('button', { name: '第 1 页', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('搜索数据表').pressSequentially('不存在');
  await expect(page.getByLabel('搜索数据表')).toBeFocused();
  await expect(page.getByText('没有符合条件的记录，请调整筛选。')).toBeVisible();
  await expect(page.getByLabel('选择本页全部')).toBeDisabled();
  await page.getByRole('button', { name: '重置筛选', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('排序、分页和每页条数对同一数据集正确生效', async ({ page }) => {
  await page.getByRole('button', { name: '记录数' }).click();
  await expect(page.locator('tbody tr td:nth-child(2)')).toHaveText(['项目丙', '项目甲']);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('tbody tr td:nth-child(2)')).toHaveText(['项目戊', '项目丁']);
  await page.getByRole('button', { name: '记录数' }).click();
  await expect(page.locator('tbody tr td:nth-child(2)')).toHaveText(['项目乙', '项目丁']);
  await page.getByLabel('每页条数').selectOption('5');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.getByRole('button', { name: '下一页', exact: true })).toBeDisabled();
});

test('当页全选与跨页保留、批量标记及清空不会扩大操作范围', async ({ page }) => {
  await page.getByLabel('选择项目甲', { exact: true }).check();
  expect(await page.getByLabel('选择本页全部').evaluate(node => node.indeterminate)).toBe(true);
  await page.getByLabel('选择本页全部').check();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await page.getByLabel('选择项目丙', { exact: true }).check();
  await page.getByRole('button', { name: '批量标记', exact: true }).click();
  expect(await page.evaluate(() => tableCase.batches)).toEqual([{ action: 'mark', ids: [1, 2, 3] }]);
  await expect(page.locator('tbody')).toContainText('已标记');
  await page.getByRole('button', { name: '清除选择', exact: true }).click();
  await expect(page.getByRole('button', { name: '批量标记', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => tableCase.table.state.selected)).toEqual([]);
});

test('列显隐、编辑中的筛选和已选行在12组外观中保持', async ({ page }) => {
  await page.evaluate(async () => {
    tableCase.surface.destroy();
    const { createSurface, libraries } = await import('/src/index.mjs');
    window.instances = Object.entries(libraries).map(([library, definition]) => {
      const surface = createSurface(document.querySelector('#fixture'), { library });
      const table = surface.table({ ...tableCase.props, query: '项目', selected: [1], visibleColumns: ['name', 'count'] });
      return { surface, table, colors: definition.colors.map(color => color.id) };
    });
  });
  const results = await page.evaluate(() => instances.map(({ surface, table, colors }) => {
    const original = table.element.querySelector('input[type=search]'); original.focus(); original.setSelectionRange(1, 2);
    return colors.flatMap(color => ['light', 'dark'].map(mode => {
      surface.setAppearance({ color, mode });
      return { state: table.state, focused: document.activeElement === original, sameNode: original === table.element.querySelector('input[type=search]') };
    }));
  }).flat());
  expect(results).toHaveLength(12);
  for (const result of results) {
    expect(result.focused && result.sameNode).toBe(true);
    expect(result.state.query).toBe('项目'); expect(result.state.selected).toEqual([1]);
    expect(result.state.visibleColumns).toEqual(['name', 'count']);
  }
  const first = page.locator('.dpc-table-component').first();
  await first.locator('summary').click();
  await first.getByLabel('负责人', { exact: true }).check();
  await expect(first.locator('th').filter({ hasText: '负责人' })).toBeVisible();
});

test('更新数据移除失效选择，拒绝重复行，业务文字不会执行HTML', async ({ page }) => {
  const text = '<img src=x onerror="window.executed=true">';
  await page.evaluate(text => tableCase.table.update({ rows: [{ id: 9, name: text, count: 1 }], selected: [1, 9] }), text);
  await expect(page.locator('tbody')).toContainText(text);
  await expect(page.locator('tbody img')).toHaveCount(0);
  expect(await page.evaluate(() => tableCase.table.state.selected)).toEqual([9]);
  expect(await page.evaluate(() => { try { tableCase.table.update({ rows: [{ id: 1 }, { id: 1 }] }); return false; } catch { return true; } })).toBe(true);
  await expect(page.locator('tbody')).toContainText(text);
});

test('两个表格独立，销毁后保留的节点不再触发业务回调', async ({ page }) => {
  const result = await page.evaluate(() => {
    const second = tableCase.surface.table({ ...tableCase.props, selected: [2] });
    const oldSearch = tableCase.table.element.querySelector('input[type=search]');
    let changes = 0; tableCase.table.update({ onChange() { changes++; } });
    tableCase.table.destroy(); tableCase.table.destroy();
    oldSearch.value = '销毁后的输入'; oldSearch.dispatchEvent(new Event('input', { bubbles: true }));
    let refused = false; try { tableCase.table.update({ query: '错误' }); } catch { refused = true; }
    return { changes, refused, selected: second.state.selected, remaining: second.element.isConnected };
  });
  expect(result).toEqual({ changes: 0, refused: true, selected: [2], remaining: true });
});

test('表格在12组外观下保持原样稿的字号、留白、边线和配色', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reference = await context.newPage(); await reference.emulateMedia({ reducedMotion: 'reduce' });
  const cssFile = existsSync(new URL('../../docs/demo/preview.css', import.meta.url)) ? new URL('../../docs/demo/preview.css', import.meta.url) : new URL('../../examples/preview/preview.css', import.meta.url);
  await reference.setContent('<!doctype html><html lang="zh-CN"><body><main class="specimen" style="width:900px"><div class="table-wrap"><table class="project-table admin-table"><thead><tr><th><input type="checkbox"></th><th>项目</th></tr></thead><tbody><tr><td><input type="checkbox"></td><td>项目甲</td></tr></tbody></table></div></main></body></html>');
  await reference.addStyleTag({ content: await readFile(cssFile, 'utf8') });
  const style = selectors => selectors.map(selector => {
    const value = getComputedStyle(document.querySelector(selector));
    return Object.fromEntries(['fontFamily', 'fontSize', 'fontWeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'backgroundColor', 'color', 'borderRadius', 'borderBottomWidth', 'borderBottomColor'].map(key => [key, value[key]]));
  });
  for (const [library, definition] of Object.entries(libraries)) {
    await page.evaluate(async library => {
      tableCase.surface.destroy(); const { createSurface } = await import('/src/index.mjs');
      tableCase.surface = createSurface(document.querySelector('#fixture'), { library }); tableCase.table = tableCase.surface.table(tableCase.props);
    }, library);
    for (const theme of definition.colors) for (const mode of ['light', 'dark']) {
      await page.evaluate(({ color, mode }) => tableCase.surface.setAppearance({ color, mode }), { color: theme.id, mode });
      await reference.evaluate(({ library, mode, palette }) => { const root = document.querySelector('.specimen'); root.dataset.library = library; root.dataset.mode = mode; for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--${key}`, value); }, { library, mode, palette: theme[mode] });
      expect(await page.evaluate(style, ['.dpc-table-wrap', '.dpc-data-table th:nth-child(2)', '.dpc-data-table tr:last-child td:nth-child(2)'])).toEqual(await reference.evaluate(style, ['.table-wrap', '.admin-table th:nth-child(2)', '.admin-table tr:last-child td:nth-child(2)']));
    }
  }
  await reference.close();
});
