import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, cp, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRelease, verifyRelease } from '../../scripts/release.mjs';
import { startPreview } from '../../scripts/preview-server.mjs';

async function fixture(t, version = '0.1.0-test.1') {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'design-pal-codex-release-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const output = path.join(temp, version);
  const manifest = await createRelease({ output, version });
  return { temp, output, manifest };
}
test('固定发行包含完整组合、文档和许可，可离开源码独立提供首页与组件', async t => {
  const f = await fixture(t);
  const independent = path.join(f.temp, 'independent');
  await cp(f.output, independent, { recursive: true });
  const manifest = await verifyRelease(independent);
  assert.equal(manifest.libraries.flatMap(library => library.colors.flatMap(color => [color.light, color.dark])).length, 12);
  for (const file of ['README.md', 'README.zh-CN.md', 'HOW-IT-WORKS.md', 'src/assets/LICENSE-phosphor.txt', 'src/assets/SOURCE.md', 'examples/preview/index.html', 'examples/preview/assets/SOURCE.md']) assert(manifest.files.some(entry => entry.path === file), file);
  assert(!manifest.files.some(entry => /^(?:docs|tests|node_modules|\.git)\//.test(entry.path)));
  const server = await startPreview({ root: independent, port: 0 });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/`)).status, 200);
  for (const file of manifest.files.filter(entry => entry.path.startsWith('src/'))) assert.equal((await fetch(`${base}/${file.path}`)).status, 200, file.path);
  assert.equal((await fetch(`${base}/release.json`)).status, 404);
});
test('重复版本及并发生成均不能覆盖已有内容', async t => {
  const f = await fixture(t);
  const before = await readFile(path.join(f.output, 'release.json'), 'utf8');
  await assert.rejects(createRelease({ output: f.output, version: f.manifest.version }), /拒绝覆盖/);
  assert.equal(await readFile(path.join(f.output, 'release.json'), 'utf8'), before);
  const output = path.join(f.temp, 'race');
  const results = await Promise.allSettled([createRelease({ output, version: '0.1.0-test.2' }), createRelease({ output, version: '0.1.0-test.2' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  await verifyRelease(output);
});
test('缺文件、篡改与清单外资源均不能使用', async t => {
  const f = await fixture(t);
  const file = path.join(f.output, 'src/index.mjs');
  const original = await readFile(file);
  await writeFile(file, '被改动');
  await assert.rejects(verifyRelease(f.output), /被修改/);
  await rm(file);
  await assert.rejects(verifyRelease(f.output), /缺少|ENOENT/);
  await writeFile(file, original);
  await writeFile(path.join(f.output, 'private.txt'), '不能混入');
  await assert.rejects(verifyRelease(f.output), /清单外/);
});
test('拒绝链接、非法路径及不完整三库清单', async t => {
  const f = await fixture(t);
  await symlink(f.output, path.join(f.temp, 'link'));
  await assert.rejects(verifyRelease(path.join(f.temp, 'link')), /符号链接/);
  const manifestFile = path.join(f.output, 'release.json');
  const manifest = JSON.parse(await readFile(manifestFile));
  manifest.files[0].path = '../outside';
  await writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(verifyRelease(f.output), /无效/);
  for (const version of ['../escape', '', 'latest', '1/2/3']) await assert.rejects(createRelease({ output: path.join(f.temp, 'bad'), version }), /版本/);
});

test('清单漏列被页面引用的资源仍会拒绝发行', async t => {
  const f = await fixture(t);
  const manifestFile = path.join(f.output, 'release.json');
  const manifest = JSON.parse(await readFile(manifestFile));
  const missing = 'src/components/button.mjs';
  await rm(path.join(f.output, missing));
  manifest.files = manifest.files.filter(entry => entry.path !== missing);
  await writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(verifyRelease(f.output), /资源缺失/);
});

test('不能把缺少首页真实配色图的包当成完整发行', async t => {
  const f = await fixture(t);
  const manifestFile = path.join(f.output, 'release.json');
  const manifest = JSON.parse(await readFile(manifestFile));
  const missing = 'src/preview/previews/order-indigo.jpg';
  await rm(path.join(f.output, missing));
  manifest.files = manifest.files.filter(entry => entry.path !== missing);
  await writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(verifyRelease(f.output), /预览图片/);
});

test('旧格式发行缺少新增双语说明时仍可按自身清单校验', async t => {
  const f = await fixture(t);
  const manifestFile = path.join(f.output, 'release.json');
  const manifest = JSON.parse(await readFile(manifestFile));
  manifest.format = 1;
  manifest.files = manifest.files.filter(entry => entry.path !== 'README.zh-CN.md');
  await rm(path.join(f.output, 'README.zh-CN.md'));
  await writeFile(manifestFile, JSON.stringify(manifest));
  assert.equal((await verifyRelease(f.output)).version, f.manifest.version);
});


test('新增工作原理不使先前同格式固定发行失效', async t => {
  const f = await fixture(t);
  const file = 'HOW-IT-WORKS.md';
  const manifestFile = path.join(f.output, 'release.json');
  const manifest = JSON.parse(await readFile(manifestFile));
  manifest.files = manifest.files.filter(entry => entry.path !== file);
  await rm(path.join(f.output, file));
  await writeFile(manifestFile, JSON.stringify(manifest));
  assert.equal((await verifyRelease(f.output)).version, f.manifest.version);
});
