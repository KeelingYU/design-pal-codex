import { test, expect } from '@playwright/test';
import { componentGroups } from '../../src/libraries/component-list.mjs';

for (const library of ['order', 'ease', 'edge']) {
  test(`${library} 的目录覆盖全部独立入口且在三种窗口下无错误`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/src/preview/components.html?library=${library}`);
    const expected = componentGroups.flatMap(group => group.methods).sort();
    expect(await page.locator('[data-component]').evaluateAll(nodes => [...new Set(nodes.map(node => node.dataset.component))].sort())).toEqual(expected);
    expect(await page.evaluate(async () => {
      const { createSurface } = await import('/src/index.mjs');
      const surface = createSurface(document.createElement('div'));
      const keys = Object.keys(surface).filter(key => typeof surface[key] === 'function' && !['destroy', 'setAppearance'].includes(key)).sort(); surface.destroy(); return keys;
    })).toEqual(expected);
    for (const width of [1440, 1024, 820]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator('.catalog-group')).toHaveCount(8);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect(page.getByLabel('已填写项目名称', { exact: true })).toBeVisible();
    await page.getByLabel('已填写项目名称', { exact: true }).fill('跨主题保留的文字');
    await page.getByRole('tab').nth(1).click();
    await page.getByRole('button', { name: '切换暗色', exact: true }).click();
    await expect(page.getByLabel('已填写项目名称', { exact: true })).toHaveValue('跨主题保留的文字');
    await expect(page.locator('#feedback [data-component=feedback]')).toHaveCount(6);
    await page.getByRole('button', { name: '本月', exact: true }).click();
    await expect(page.locator('[data-component=statistic]')).toContainText('2944');
    await page.getByRole('button', { name: '预览归档确认', exact: true }).click();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByText('已取消，当前内容保持。', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`组件目录-${library}.png`), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const group of ['forms', 'table', 'navigation', 'metrics']) await page.locator(`#${group}`).screenshot({ path: test.info().outputPath(`${group}-${library}.png`) });
  });
}

test('未知库不悄悄替换成另一个设计', async ({ page }) => {
  await page.goto('/src/preview/components.html?library=missing');
  await expect(page.getByText('没有找到这个组件库，请返回选择。')).toBeVisible();
  await expect(page.locator('.dpc-root')).toHaveCount(0);
});
