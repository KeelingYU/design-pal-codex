import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { startPreview } from './preview-server.mjs';
import { libraries } from '../src/libraries/catalog.mjs';

// 图片只能来自本机实际预览；先拍完全部组合，成功后再替换首页资产。
const project = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(project, 'src/preview/previews');
const temporary = await mkdtemp(path.join(tmpdir(), 'design-pal-codex-previews-'));
let server, browser;
try {
  await build();
  server = await startPreview({ port: 0 });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 931, height: 792 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const names = [];
  for (const [library, definition] of Object.entries(libraries)) for (const color of definition.colors) {
    await page.goto(`http://127.0.0.1:${server.address().port}/src/preview/preview.html?library=${library}&color=${color.id}&mode=light&view=layout&capture=1`);
    await page.locator('.workbench').waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    if (await page.locator('#result-count').textContent() !== '当前显示 3 项') throw new Error('截图页面内容不完整');
    if (await page.locator('.tool-header').isVisible() || errors.length) throw new Error('截图页面存在异常');
    const name = `${library}-${color.id}.jpg`;
    await page.screenshot({ path: path.join(temporary, name), type: 'jpeg', quality: 85 });
    names.push(name);
  }
  await mkdir(output, { recursive: true });
  for (const name of names) await copyFile(path.join(temporary, name), path.join(output, name));
  console.log(`已从真实页面拍摄 ${names.length} 张配色图：${names.join('、')}。公开前须目视审核并更新图片摘要。`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
await build();
