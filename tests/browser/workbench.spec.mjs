import { test, expect } from '@playwright/test';
import { libraries } from '../../src/libraries/catalog.mjs';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const url = (library, color, mode, capture = false) => `/src/preview/preview.html?library=${library}&view=layout&color=${color}&mode=${mode}${capture ? '&capture=1' : ''}`;
for (const [library, data] of Object.entries(libraries)) for (const color of data.colors) for (const mode of ['light', 'dark']) {
  test(`${library}/${color.id}/${mode} 页面搜索、筛选、详情与切色保值`, async ({ page }) => {
    await page.goto(url(library, color.id, mode));
    const workbench = page.locator('.workbench');
    await expect(workbench).toHaveAttribute('data-page-layout', data.layout);
    await expect(workbench.locator('#result-count')).toHaveText('当前显示 3 项');
    await workbench.getByRole('textbox', { name: '搜索项目', exact: true }).fill('林悦');
    await expect(workbench.locator('#result-count')).toHaveText('当前显示 2 项');
    await workbench.getByRole('button', { name: '待处理', exact: true }).click();
    await workbench.getByRole('button', { name: '查看运营数据看板', exact: true }).click();
    const detail = library === 'edge' ? workbench.locator('.edge-detail') : page.locator('.workbench-dialog[open]');
    await expect(detail.getByRole('heading', { name: '运营数据看板', exact: true })).toBeVisible();
    await expect(detail).toContainText('完成进度 · 42%');
    if (library !== 'edge') {
      await page.keyboard.press('Escape');
      await expect(workbench.getByRole('button', { name: '查看运营数据看板', exact: true })).toBeFocused();
    }
    const other = data.colors.find(item => item.id !== color.id);
    await page.locator(`[data-color-choice="${other.id}"]`).click();
    await page.locator(`button[data-mode="${mode === 'light' ? 'dark' : 'light'}"]`).click();
    await expect(workbench.getByRole('textbox', { name: '搜索项目', exact: true })).toHaveValue('林悦');
    await expect(workbench.getByRole('button', { name: '待处理', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(workbench.locator('#result-count')).toHaveText('当前显示 2 项');
    if (library === 'edge') await expect(detail.getByRole('heading', { name: '运营数据看板', exact: true })).toBeVisible();
    await page.locator('[data-view="components"]').click();
    await page.locator('[data-view="layout"]').click();
    await expect(workbench.getByRole('textbox', { name: '搜索项目', exact: true })).toHaveValue('林悦');
    await workbench.getByRole('textbox', { name: '搜索项目', exact: true }).fill('知识管理');
    await workbench.getByRole('button', { name: '已就绪', exact: true }).click();
    await expect(workbench.locator('#result-count')).toHaveText('当前显示 1 项');
    await workbench.getByRole('textbox', { name: '搜索项目', exact: true }).fill('不存在');
    await workbench.getByRole('button', { name: '清除筛选', exact: true }).click();
    await expect(workbench.locator('#result-count')).toHaveText('当前显示 3 项');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
for (const library of Object.keys(libraries)) {
  test(`${library} 页面场景可恢复且详情方式正确`, async ({ page }) => {
    await page.goto(url(library, libraries[library].colors[0].id, 'light'));
    for (const [scenario, title, action] of [['loading', '正在加载项目', null], ['empty', '还没有项目', '查看示例项目'], ['error', '项目暂时无法加载', '重新加载']]) {
      await page.locator(`[data-scenario="${scenario}"]`).click();
      await expect(page.locator('.page-feedback')).toContainText(title);
      if (action) await page.getByRole('button', { name: action, exact: true }).click();
      else await page.locator('[data-scenario="normal"]').click();
      await expect(page.locator('#result-count')).toHaveText('当前显示 3 项');
    }
    await page.getByRole('button', { name: '查看团队知识中心', exact: true }).click();
    await expect(page.locator(`.workbench [data-detail-style="${libraries[library].detail}"]`)).toBeVisible();
  });

  test(`${library} 与原样稿关键页面几何保持一致`, async ({ page, context }) => {
    await page.setViewportSize({ width: 931, height: 792 });
    const reference = await context.newPage();
    await reference.setViewportSize({ width: 931, height: 792 });
    await reference.route('http://baseline.local/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      try {
        const body = await readFile(resolve(existsSync('docs/demo') ? 'docs/demo' : 'examples/preview', `.${pathname}`));
        await route.fulfill({ body, contentType: pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'text/javascript' : 'text/html' });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });
    const color = libraries[library].colors[0].id;
    await reference.goto(`http://baseline.local/preview.html?library=${library}&color=${color}&view=layout&capture=1`);
    await page.goto(url(library, color, 'light', true));
    for (const selector of ['.workbench', '.workspace-head', '.search-box input', '.work-summary', ...(library === 'order' ? ['.order-sidebar', '.table-wrap', '.project-table tbody tr:first-child'] : library === 'ease' ? ['.ease-top', '.project-cards', '.project-card:first-child'] : ['.edge-rail', '.edge-split', '.edge-list', '.edge-detail'])]) {
      const expected = await reference.locator(selector).boundingBox();
      const actual = await page.locator(selector).boundingBox();
      for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(actual[key] - expected[key]), `${selector} ${key}`).toBeLessThanOrEqual(1);
    }
    if (library !== 'edge') {
      await reference.getByRole('button', { name: '查看客户服务工作台', exact: true }).click();
      await page.getByRole('button', { name: '查看客户服务工作台', exact: true }).click();
      await page.waitForTimeout(450);
      for (const [source, target] of [['#demo-dialog', '.workbench-dialog'], ['#demo-dialog .detail-content', '.workbench-dialog .detail-content'], ['#demo-dialog .dialog-actions', '.workbench-dialog .dpc-detail-actions']]) {
        const expected = await reference.locator(source).boundingBox(); const actual = await page.locator(target).boundingBox();
        for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(actual[key] - expected[key]), `${target} ${key}`).toBeLessThanOrEqual(1);
      }
    }
    await reference.close();
  });
}
