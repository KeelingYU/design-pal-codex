import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRelease } from '../../scripts/release.mjs';
import { installSkills } from '../../scripts/install-skills.mjs';

async function fixture(t) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'design-pal-codex-skills-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const releaseRoot = path.join(base, 'release');
  const projectRoot = path.join(base, 'project');
  const homeRoot = path.join(base, 'home');
  await Promise.all([mkdir(projectRoot), mkdir(homeRoot)]);
  await createRelease({ output: releaseRoot, version: '0.1.0-test.skills' });
  return { base, releaseRoot, projectRoot, homeRoot, codexHome: path.join(homeRoot, '.codex') };
}

test('项目安装为两端复制同一技能并指向完整固定发行，不修改另一套工具', async t => {
  const context = await fixture(t);
  const other = path.join(context.projectRoot, '.agents/skills/design-pal');
  await mkdir(other, { recursive: true });
  await writeFile(path.join(other, 'SKILL.md'), '---\nname: design-pal\n---\n另一项目');
  const result = await installSkills(context);
  assert.equal(result.destinations.length, 2);
  for (const destination of result.destinations) {
    assert.equal(await readFile(path.join(destination, 'SKILL.md'), 'utf8'), await readFile(path.join(context.releaseRoot, 'skills/design-pal-codex/SKILL.md'), 'utf8'));
    const location = JSON.parse(await readFile(path.join(destination, 'release-location.json')));
    assert.equal(location.version, '0.1.0-test.skills');
    assert.equal(location.releaseRoot, context.releaseRoot);
  }
  assert.match(await readFile(path.join(other, 'SKILL.md'), 'utf8'), /另一项目/);
  assert.deepEqual(await readdir(context.homeRoot), []);
});

test('已有任意一个目标会拒绝整次安装，不留下另一端技能', async t => {
  const context = await fixture(t);
  const existing = path.join(context.projectRoot, '.claude/skills/design-pal-codex');
  await mkdir(existing, { recursive: true });
  await writeFile(path.join(existing, 'keep'), '原内容');
  await assert.rejects(installSkills(context), /已有同名/);
  assert.deepEqual(await readdir(context.projectRoot), ['.claude']);
  assert.equal(await readFile(path.join(existing, 'keep'), 'utf8'), '原内容');
});

test('不同目录声明同名能力或祖先范围同名能力均拒绝安装', async t => {
  const context = await fixture(t);
  const existing = path.join(context.base, '.agents/skills/other-name');
  await mkdir(existing, { recursive: true });
  await writeFile(path.join(existing, 'SKILL.md'), '---\nname: "design-pal-codex"\ndescription: 测试\n---\n');
  await assert.rejects(installSkills(context), /同名声明/);
  assert.deepEqual(await readdir(context.projectRoot), []);
});

test('个人及插件缓存声明也阻止重复安装', async t => {
  const context = await fixture(t);
  const existing = path.join(context.homeRoot, '.claude/plugins/cache/test/skills/other');
  await mkdir(existing, { recursive: true });
  await writeFile(path.join(existing, 'SKILL.md'), '---\nname: design-pal-codex\n---\n');
  await assert.rejects(installSkills(context), /同名声明/);
  assert.deepEqual(await readdir(context.projectRoot), []);
});

test('个人安装没有明确批准时不写入，通过批准参数才写指定范围', async t => {
  const context = await fixture(t);
  await assert.rejects(installSkills({ ...context, scope: 'personal' }), /明确批准/);
  assert.deepEqual(await readdir(context.homeRoot), []);
  const result = await installSkills({ ...context, host: 'codex', scope: 'personal', approvePersonal: true });
  assert.deepEqual(result.destinations, [path.join(context.homeRoot, '.agents/skills/design-pal-codex')]);
  assert.deepEqual(await readdir(context.projectRoot), []);
});

test('目标中的符号链接不得把安装导向项目外', async t => {
  const context = await fixture(t);
  await symlink(context.homeRoot, path.join(context.projectRoot, '.agents'));
  await assert.rejects(installSkills(context), /符号链接/);
  assert.deepEqual(await readdir(context.homeRoot), []);
});

test('发行文件被改动时安装失败且目标不变', async t => {
  const context = await fixture(t);
  await writeFile(path.join(context.releaseRoot, 'skills/design-pal-codex/SKILL.md'), '改变内容');
  await assert.rejects(installSkills(context), /被修改/);
  assert.deepEqual(await readdir(context.projectRoot), []);
});

test('未知宿主与范围不能静默变成全局安装', async t => {
  const context = await fixture(t);
  await assert.rejects(installSkills({ ...context, host: 'unknown' }), /宿主/);
  await assert.rejects(installSkills({ ...context, scope: 'global' }), /范围/);
  assert.deepEqual(await readdir(context.projectRoot), []);
  assert.deepEqual(await readdir(context.homeRoot), []);
});


test('命令行选项缺少值时拒绝，不静默执行默认安装', async t => {
  const context = await fixture(t);
  for (const option of ['--host', '--scope']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/install-skills.mjs', import.meta.url)), context.releaseRoot, context.projectRoot, option], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /参数缺少值/);
    assert.deepEqual(await readdir(context.projectRoot), []);
  }
});

test('管理员范围已有同名能力时拒绝安装且不改变双方文件', async t => {
  const context = await fixture(t);
  const systemSkillsRoot = path.join(context.base, 'system-skills');
  const existing = path.join(systemSkillsRoot, 'managed-tool');
  await mkdir(existing, { recursive: true });
  const original = '---\nname: design-pal-codex\n---\n管理员提供的能力';
  await writeFile(path.join(existing, 'SKILL.md'), original);
  await assert.rejects(installSkills({ ...context, systemSkillsRoot }), /同名声明/);
  assert.deepEqual(await readdir(context.projectRoot), []);
  assert.equal(await readFile(path.join(existing, 'SKILL.md'), 'utf8'), original);
});
