import { test, expect } from '@playwright/test';

test('首次打开总览停留顶部，不把默认分组写成跳转锚点', async ({ page }) => {
  await page.goto('/src/preview/preview.html?library=order');
  await expect(page.locator('[data-formal-catalog]')).toBeVisible();
  expect(await page.evaluate(() => ({ hash: location.hash, y: scrollY }))).toEqual({ hash: '', y: 0 });
});

test('固定库的颜色、主导航与返回地址一致，刷新恢复定位', async ({ page }) => {
  await page.goto('/src/preview/preview.html?library=ease&color=sage&mode=dark&view=info');
  await expect(page.locator('#current-library')).toContainText('松弛');
  await expect(page.getByRole('tab', { name: '鼠尾草', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '库说明', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#detail-sidebar')).toBeHidden();
  await expect(page.locator('.detail-shell')).toHaveClass(/no-sidebar/);
  await page.getByRole('tab', { name: '陶土', exact: true }).click();
  await expect(page).toHaveURL(/color=clay/);
  await page.reload();
  await expect(page.getByRole('tab', { name: '库说明', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '陶土', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('link', { name: '返回组件库首页', exact: true }).click();
  await expect(page.locator('.library-card[data-library=ease]')).toHaveAttribute('data-active-color', 'clay');
});

test('颜色和主导航支持键盘，侧栏定位不丢表单内容', async ({ page }) => {
  await page.goto('/src/preview/preview.html?library=order&view=components#advanced-fields');
  await expect(page.locator('[data-section="advanced-fields"]')).toHaveAttribute('aria-current', 'location');
  await page.locator('[data-section="fields"]').click();
  await expect(page.locator('[data-section="fields"]')).toHaveAttribute('aria-current', 'location');
  const input = page.locator('[data-formal-catalog]').getByRole('textbox', { name: '项目名称', exact: true });
  await input.fill('跨视图保留');
  await page.getByRole('tab', { name: '组件总览', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '库说明', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(input).toHaveValue('跨视图保留');
  await page.getByRole('tab', { name: '靛青', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '岩灰', exact: true })).toBeFocused();
  await expect(input).toHaveValue('跨视图保留');
  await expect(page.locator('.tool-header select,.tool-subbar select,#detail-sidebar select,[data-library-choice],[data-focus-mode]')).toHaveCount(0);
});

for (const width of [1440, 1024, 820]) test(`详情在 ${width} 窗口保持窄侧栏、主预览和页面状态操作`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/src/preview/preview.html?library=edge&view=layout');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const preview = await page.locator('#preview-panel').boundingBox(); const sidebar = await page.locator('#detail-sidebar').boundingBox();
  expect(preview.width / width).toBeGreaterThan(.8); expect(sidebar.width).toBeLessThanOrEqual(112);
  await page.getByRole('button', { name: '失败', exact: true }).click();
  await expect(page).toHaveURL(/scenario=error/);
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByRole('button', { name: '正常', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).not.toHaveURL(/scenario=error/);
  await page.getByRole('tab', { name: '组件总览', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`详情-${width}.png`), fullPage: false });
  expect(errors).toEqual([]);
});

test('无效库或配色明确显示缺口，不用其他库冒充', async ({ page }) => {
  for (const query of ['library=missing', 'library=order&color=sage']) {
    await page.goto('/src/preview/preview.html?' + query);
    await expect(page.getByRole('alert')).toContainText('无法打开此预览');
    await expect(page.locator('#preview-panel')).toHaveCount(0);
  }
});
