import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { libraries } from '../../src/libraries/catalog.mjs';

const base = '/src/preview/index.html';
const card = (page, key = 'order') => page.locator(`.library-card[data-library="${key}"]`);
const baseline = existsSync(new URL('../../docs/demo/index.html', import.meta.url)) ? '../../docs/demo/' : '../../examples/preview/';

async function leaveCards(page) {
  await page.locator('.gallery-brand').focus();
  await page.mouse.move(1, 1);
}

test('五秒轮播，悬停、聚焦、手动暂停与页面隐藏均停止，恢复后继续', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-27T00:00:10Z'));
  await page.goto(base);
  await leaveCards(page);
  await page.clock.runFor(4999);
  await expect(card(page)).toHaveAttribute('data-active-color', 'indigo');
  await page.clock.runFor(1);
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
  await card(page).hover();
  await page.clock.runFor(5000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
  await page.mouse.move(1, 1);
  await card(page).getByRole('button', { name: '规整下一配色' }).focus();
  await page.clock.runFor(5000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
  await card(page).getByRole('button', { name: '暂停规整自动轮播' }).click();
  await leaveCards(page);
  await page.clock.runFor(5000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
  await card(page).getByRole('button', { name: '播放规整自动轮播' }).click();
  await leaveCards(page);
  await page.clock.runFor(5000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'indigo');
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await page.clock.runFor(5000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'indigo');
  await page.evaluate(() => delete document.hidden);
  await page.clock.runFor(5000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
});

test('键盘圆点和箭头不跳转，减少动态效果默认暂停并能主动播放', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-27T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-27T00:00:10Z'));
  await page.goto(base);
  await leaveCards(page);
  await page.clock.runFor(10000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'indigo');
  const dot = card(page).getByRole('button', { name: '查看靛青配色' });
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(card(page).getByRole('button', { name: '查看岩灰配色' })).toBeFocused();
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
  await page.keyboard.press('Enter');
  await card(page).getByRole('button', { name: '规整下一配色' }).click();
  await expect(card(page)).toHaveAttribute('data-active-color', 'indigo');
  await expect(page).toHaveURL(new RegExp('index.html$'));
  await card(page).getByRole('button', { name: '播放规整自动轮播' }).click();
  await leaveCards(page);
  await page.clock.runFor(5000);
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
});

test('产品筛选保留各库配色，刷新和详情返回正确恢复', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await card(page).getByRole('button', { name: '查看岩灰配色' }).click();
  await card(page, 'ease').getByRole('button', { name: '查看鼠尾草配色' }).click();
  await page.locator('#product-filters').getByRole('button', { name: '数据管理', exact: true }).click();
  await expect(page.locator('.library-card:visible')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.library-card:visible')).toHaveCount(1);
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
  await card(page).getByRole('link', { name: '查看规整组件库' }).click();
  await expect(page).toHaveURL(/preview.html\?library=order&color=slate/);
  await page.goBack();
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
  await page.locator('#product-filters').getByRole('button', { name: '全部', exact: true }).click();
  await expect(card(page, 'ease')).toHaveAttribute('data-active-color', 'sage');
  await page.goto(`${base}?library=order&color=indigo`);
  await expect(card(page)).toHaveAttribute('data-active-color', 'indigo');
  await expect(card(page, 'ease')).toHaveAttribute('data-active-color', 'sage');
  await card(page).getByRole('button', { name: '查看岩灰配色' }).click();
  await page.reload();
  await expect(card(page)).toHaveAttribute('data-active-color', 'slate');
});

for (const width of [1440, 1024, 820]) {
  test(`首页在 ${width} 窗口保留样稿布局与真实配色图`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await expect(page.locator('.library-card')).toHaveCount(3);
    for (const [key, library] of Object.entries(libraries)) {
      for (const color of library.colors) {
        const img = card(page, key).locator(`img[src$="${key}-${color.id}.jpg"]`);
        await expect(img).toHaveCount(1);
        await expect.poll(() => img.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const reference = await context.newPage();
    await reference.setViewportSize({ width, height: 1000 });
    await reference.emulateMedia({ reducedMotion: 'reduce' });
    const html = await readFile(new URL(`${baseline}index.html`, import.meta.url), 'utf8');
    await reference.setContent(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link[^>]*rel="stylesheet"[^>]*>/g, ''));
    await reference.addStyleTag({ content: await readFile(new URL(`${baseline}gallery.css`, import.meta.url), 'utf8') });
    await reference.addScriptTag({ content: await readFile(new URL(`${baseline}preview-model.js`, import.meta.url), 'utf8') });
    await reference.addScriptTag({ content: await readFile(new URL(`${baseline}gallery.js`, import.meta.url), 'utf8') });
    const measure = () => [...document.querySelectorAll('.gallery-header,.gallery-heading,.product-filters,.library-card,.preview-image,.color-caption')].map(node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, padding: style.padding, color: style.color, background: style.backgroundColor, font: style.font, radius: style.borderRadius };
    });
    expect(await page.evaluate(measure)).toEqual(await reference.evaluate(measure));
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`首页-${width}.png`), fullPage: true });
    await reference.close();
  });
}

test('业务文字按原文展示，损坏的会话记录不阻断首页', async ({ page }) => {
  const unsafe = '<img src=x onerror="window.unwantedExecution=true">';
  await page.route('**/src/libraries/catalog.mjs', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace('"规整"', JSON.stringify(unsafe)).replace('"数据管理"', JSON.stringify(unsafe)) });
  });
  await page.addInitScript(() => sessionStorage.setItem('design-pal-codex:gallery', '{broken'));
  await page.goto(base);
  await expect(card(page).locator('h2')).toHaveText(unsafe);
  await expect(page.locator('.library-card')).toHaveCount(3);
  await expect(card(page).locator('h2 img')).toHaveCount(0);
  await expect(page.locator('#product-filters img')).toHaveCount(0);
  expect(await page.evaluate(() => window.unwantedExecution)).toBeUndefined();
  await page.locator('#product-filters').getByRole('button', { name: unsafe, exact: true }).click();
  await expect(page.locator('.library-card:visible')).toHaveCount(1);
});
