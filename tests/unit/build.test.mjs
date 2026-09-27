import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build, requiredFiles } from '../../scripts/build.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'design-pal-codex-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'src');
  const output = path.join(root, 'dist');
  for (const file of requiredFiles) {
    await mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await writeFile(path.join(source, file), `测试资源：${file}`);
  }
  return { root, source, output };
}

test('构建只复制源码资源及许可，并保持相对路径', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'private.md'), '不应进入预览');
  await build(f);
  assert.deepEqual((await readdir(f.output)).sort(), ['.design-pal-codex-build.json', 'src']);
  for (const file of requiredFiles) {
    assert.equal(await readFile(path.join(f.output, 'src', file), 'utf8'), `测试资源：${file}`);
  }
});

test('重复构建移除过期资源，并刷新当前资源', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.source, 'old.css'), '旧资源');
  await build(f);
  await rm(path.join(f.source, 'old.css'));
  await writeFile(path.join(f.source, 'index.mjs'), '新资源');
  await build(f);
  await assert.rejects(readFile(path.join(f.output, 'src/old.css')), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(f.output, 'src/index.mjs'), 'utf8'), '新资源');
});

test('增加必需资源后仍可安全更新旧版受管输出', async t => {
  const f = await fixture(t);
  await build(f);
  const marker = path.join(f.output, '.design-pal-codex-build.json');
  const manifest = JSON.parse(await readFile(marker, 'utf8'));
  manifest.files = manifest.files.filter(file => file !== 'src/preview/foundation.css');
  await rm(path.join(f.output, 'src/preview/foundation.css'));
  await writeFile(marker, JSON.stringify(manifest));
  await build(f);
  assert.equal(await readFile(path.join(f.output, 'src/preview/foundation.css'), 'utf8'), '测试资源：preview/foundation.css');
});

test('缺少必需资源或许可时失败，保留已有构建', async t => {
  const f = await fixture(t);
  await build(f);
  await rm(path.join(f.source, 'assets/LICENSE-phosphor.txt'));
  await assert.rejects(build(f), /缺少必需资源/);
  assert.equal(await readFile(path.join(f.output, 'src/index.mjs'), 'utf8'), '测试资源：index.mjs');
});

test('拒绝覆盖非受管目录及受管目录中的额外文件', async t => {
  const f = await fixture(t);
  await mkdir(f.output);
  await writeFile(path.join(f.output, 'mine.txt'), '保留');
  await assert.rejects(build(f), /受管/);
  assert.equal(await readFile(path.join(f.output, 'mine.txt'), 'utf8'), '保留');
  await rm(f.output, { recursive: true });
  await build(f);
  await writeFile(path.join(f.output, 'mine.txt'), '保留');
  await assert.rejects(build(f), /受管/);
  assert.equal(await readFile(path.join(f.output, 'mine.txt'), 'utf8'), '保留');
  await rm(path.join(f.output, 'mine.txt'));
  await mkdir(path.join(f.output, 'my-empty-directory'));
  await assert.rejects(build(f), /受管/);
  assert.deepEqual(await readdir(path.join(f.output, 'my-empty-directory')), []);
});

test('拒绝源码和输出相互包含，且不破坏源码', async t => {
  const f = await fixture(t);
  for (const output of [f.source, path.join(f.source, 'nested'), f.root]) {
    await assert.rejects(build({ source: f.source, output }), /重叠/);
  }
  assert.equal(await readFile(path.join(f.source, 'index.mjs'), 'utf8'), '测试资源：index.mjs');
});

test('拒绝源码及输出中的符号链接', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'secret.txt'), '私密内容');
  await symlink(path.join(f.root, 'secret.txt'), path.join(f.source, 'link.txt'));
  await assert.rejects(build(f), /符号链接/);
  await rm(path.join(f.source, 'link.txt'));
  await symlink(f.source, f.output);
  await assert.rejects(build(f), /符号链接/);
});
