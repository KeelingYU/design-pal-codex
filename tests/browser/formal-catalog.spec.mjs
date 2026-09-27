import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { libraries } from '../../src/index.mjs';

for (const library of Object.keys(libraries)) {
  test(`${library} 正式总览使用独立组件并保留表单、表格和页签状态`, async ({ page }) => {
    await page.goto(`/src/preview/preview.html?library=${library}&view=components`);
    const catalog = page.locator('[data-formal-catalog]');
    await expect(catalog.locator('.catalog-section')).toHaveCount(9);
    await expect(catalog.locator('[data-component="button"].dpc-btn')).toHaveCount(11);
    const name = catalog.getByRole('textbox', { name: '项目名称', exact: true });
    await name.fill('');
    await catalog.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await name.fill('保留演示项目');
    await catalog.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(catalog.getByRole('button', { name: '保存中…' })).toBeDisabled();
    await expect(catalog.locator('#save-message')).toContainText('已保存“保留演示项目”');
    const table = catalog.locator('[data-component="table"]');
    await table.getByRole('checkbox', { name: '选择客户服务工作台', exact: true }).check();
    await table.getByRole('button', { name: '下一页', exact: true }).click();
    await table.getByRole('checkbox', { name: '选择订单管理后台', exact: true }).check();
    await table.getByRole('button', { name: '批量标记', exact: true }).click();
    await expect(catalog.locator('#table-result')).toContainText('2 条');
    await expect(table.locator('.dpc-table-mark')).toHaveCount(1);
    await catalog.getByRole('tab', { name: '成员', exact: true }).click();
    for (const color of libraries[library].colors) for (const mode of ['light', 'dark']) {
      await page.locator(`[data-color-choice="${color.id}"]`).click();
      await page.locator(`button[data-mode="${mode}"]`).click();
      await expect(name).toHaveValue('保留演示项目');
      await expect(table.getByRole('checkbox', { name: '选择订单管理后台', exact: true })).toBeChecked();
      await expect(catalog.getByRole('tab', { name: '成员', exact: true })).toHaveAttribute('aria-selected', 'true');
    }
    await page.locator('[data-view="layout"]').click();
    await page.locator('[data-view="components"]').click();
    await expect(name).toHaveValue('保留演示项目');
    await expect(table.getByRole('checkbox', { name: '选择订单管理后台', exact: true })).toBeChecked();
    await expect(catalog.getByRole('tab', { name: '成员', exact: true })).toHaveAttribute('aria-selected', 'true');
  });
  test(`${library} 正式总览导航、确认、详情及并列反馈可操作`, async ({ page }) => {
    await page.goto(`/src/preview/preview.html?library=${library}&view=components`);
    const catalog = page.locator('[data-formal-catalog]');
    await catalog.getByRole('treeitem', { name: '数据团队', exact: true }).click();
    await expect(catalog.locator('#tree-result')).toHaveText('当前选择：数据团队');
    await catalog.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(catalog.locator('.dpc-step-content')).toContainText('核对原始字段');
    await catalog.getByRole('button', { name: '更多操作', exact: true }).click();
    await catalog.getByRole('menuitem', { name: '复制链接', exact: true }).click();
    await expect(catalog.locator('#menu-result')).toContainText('复制链接');
    await catalog.getByRole('button', { name: '预览归档确认', exact: true }).click();
    await catalog.getByRole('dialog').getByRole('button', { name: '确认归档', exact: true }).click();
    await expect(catalog.locator('#confirm-result')).toContainText('已确认归档演示');
    await catalog.getByRole('button', { name: '预览详情', exact: true }).click();
    const detail = catalog.locator(`[data-detail-style="${libraries[library].detail}"]`);
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: '关闭详情', exact: true }).click();
    await expect(detail).not.toBeVisible();
    await expect(catalog.locator('[data-component="feedback"]')).toHaveCount(4);
    await catalog.getByRole('button', { name: '重新尝试', exact: true }).click();
    await expect(catalog.getByText('已恢复连接', { exact: true })).toBeVisible();
    await expect(catalog.locator('[data-component="feedback"]')).toHaveCount(4);
    await expect(catalog.getByText('还没有项目', { exact: true })).toBeVisible();
  });
}

test('正式总览高级表单、表格控制与图表周期具有真实反馈', async ({ page }) => {
  await page.goto('/src/preview/preview.html?library=order&view=components');
  const catalog = page.locator('[data-formal-catalog]');
  const quantity = catalog.getByRole('spinbutton', { name: '数字输入' });
  await quantity.fill('100');
  await expect(quantity).toHaveAttribute('aria-invalid', 'true');
  await quantity.fill('20');
  await expect(quantity).toHaveAttribute('aria-invalid', 'false');
  await catalog.getByLabel('开始日期', { exact: true }).fill('2026-09-26');
  await expect(catalog.getByLabel('结束日期', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await catalog.getByLabel('结束日期', { exact: true }).fill('2026-09-30');
  await expect(catalog.getByLabel('结束日期', { exact: true })).toHaveAttribute('aria-invalid', 'false');
  await catalog.getByRole('textbox', { name: '多行输入', exact: true }).fill('测试说明');
  await expect(catalog.locator('[data-component="textarea"] .dpc-form-output')).toHaveText('4 / 180');
  await catalog.getByLabel('文件选择', { exact: true }).setInputFiles({ name: '示例.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nexample') });
  await expect(catalog.locator('[data-component="filePicker"]')).toContainText('示例.csv');
  await catalog.getByRole('button', { name: '移除文件选择' }).click();
  await expect(catalog.locator('[data-component="filePicker"]')).toContainText('尚未选择文件');
  const table = catalog.locator('[data-component="table"]');
  await table.getByLabel('按状态筛选').selectOption('已就绪');
  await expect(table.getByRole('row')).toHaveCount(3);
  await table.getByRole('button', { name: '重置筛选' }).click();
  await table.getByRole('button', { name: '记录数 ↕', exact: true }).click();
  await expect(table.locator('tbody tr').first()).toContainText('数据导入中心');
  await table.locator('summary').click();
  await table.getByLabel('负责人', { exact: true }).uncheck();
  await expect(table.getByRole('columnheader', { name: '负责人', exact: true })).toHaveCount(0);
  await catalog.getByRole('button', { name: '本月', exact: true }).click();
  await expect(catalog.locator('[data-component="statistic"]').first()).toContainText('2,944');
  await catalog.getByRole('button', { name: '第 1 周：610 条', exact: true }).click();
  await expect(catalog.locator('#chart-selection')).toHaveText('第 1 周：610 条');
});

for (const library of Object.keys(libraries)) {
  test(`${library} 正式总览九组与已确认样稿保持位置和尺寸`, async ({ page }, testInfo) => {
    const measure = () => [...document.querySelectorAll('.catalog-header,.catalog-section')].map(element => {
      const rect = element.getBoundingClientRect();
      return { id: element.id || 'header', x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    await page.route('http://baseline.local/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      try {
        const body = await readFile(resolve(existsSync('docs/demo') ? 'docs/demo' : 'examples/preview', `.${pathname}`));
        await route.fulfill({ body, contentType: pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'text/javascript' : 'text/html' });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto(`http://baseline.local/preview.html?library=${library}&view=components`);
    const reference = await page.evaluate(measure);
    const sourcePanel = library === 'edge' ? '#inline-detail' : '#demo-dialog';
    const detailGeometry = selectors => selectors.map(selector => {
      const element = document.querySelector(selector), rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height };
    });
    await page.getByRole('button', { name: '预览详情', exact: true }).click();
    await page.waitForTimeout(450);
    const referenceDetail = await page.evaluate(detailGeometry, [sourcePanel, `${sourcePanel} .detail-content`, `${sourcePanel} .detail-content h2`, `${sourcePanel} .detail-content dl`, `${sourcePanel} .progress`, `${sourcePanel} .detail-note`]);
    await page.goto(`/src/preview/preview.html?library=${library}&view=components`);
    const current = await page.evaluate(measure);
    await page.screenshot({ path: testInfo.outputPath('正式组件总览.png'), fullPage: true });
    expect(current.map(box => box.id)).toEqual(reference.map(box => box.id));
    for (let index = 0; index < current.length; index++) for (const dimension of ['x', 'y', 'width', 'height']) {
      expect.soft(Math.abs(current[index][dimension] - reference[index][dimension]), `${current[index].id} ${dimension}`).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: '预览详情', exact: true }).click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: testInfo.outputPath('详情展开.png'), fullPage: library === 'edge' });
    const targetPanel = '.catalog-details .dpc-detail-panel';
    const currentDetail = await page.evaluate(detailGeometry, [targetPanel, `${targetPanel} .detail-content`, `${targetPanel} .detail-content h2`, `${targetPanel} .detail-content dl`, `${targetPanel} .progress`, `${targetPanel} .detail-note`]);
    for (let index = 0; index < currentDetail.length; index++) for (const dimension of ['x', 'y', 'width', 'height']) {
      expect.soft(Math.abs(currentDetail[index][dimension] - referenceDetail[index][dimension]), `详情 ${index} ${dimension}`).toBeLessThanOrEqual(1);
    }
  });
}
