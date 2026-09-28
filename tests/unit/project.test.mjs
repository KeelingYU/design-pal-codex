import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRelease } from '../../scripts/release.mjs';
import { planAdoption, applyAdoption, planUpgrade, upgradeProject, projectStatus, planConfirmation, confirmProject, planDraft, recordDraft, planCustomization, customizeProject, planRestore, restoreProject, planRecovery, recoverProject } from '../../scripts/project.mjs';

let sandbox, release;
const choice = { library: 'order', color: 'indigo', mode: 'light' };
const write = (root, name, value) => fs.writeFile(path.join(root, name), value);
const read = (root, name) => fs.readFile(path.join(root, name), 'utf8');
async function target() { return fs.mkdtemp(path.join(sandbox, 'project-')); }
async function adopt(root, source = release) {
  const plan = await planAdoption(source, root, choice);
  return applyAdoption(source, root, choice, plan.digest);
}
async function confirmed(root) {
  await adopt(root);
  await write(root, 'page.html', '<p>已确认页面</p>');
  await write(root, 'resource.css', 'p { color: red; }');
  const plan = await planConfirmation(root, ['page.html', 'resource.css']);
  return confirmProject(root, ['page.html', 'resource.css'], plan.digest);
}
before(async () => {
  sandbox = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'design-pal-codex-project-')));
  release = path.join(sandbox, 'release');
  await createRelease({ output: release, version: '0.1.0-test.1' });
});
after(async () => { if (sandbox) await fs.rm(sandbox, { recursive: true, force: true }); });

test('采用预检不写目标；只有精确确认才复制固定资源，已有业务与另一工具保持', async () => {
  const root = await target();
  await write(root, 'business.txt', '现有业务');
  await fs.mkdir(path.join(root, 'design-pal'));
  await write(root, 'design-pal/other.txt', '另一工具');
  const before = await fs.readdir(root);
  const plan = await planAdoption(release, root, choice);
  assert.deepEqual(await fs.readdir(root), before);
  await assert.rejects(applyAdoption(release, root, choice, 'not-confirmed'), /确认/);
  await assert.rejects(applyAdoption(release, root, { ...choice, mode: 'dark' }, plan.digest), /变化/);
  await applyAdoption(release, root, choice, plan.digest);
  assert.equal(await read(root, 'business.txt'), '现有业务');
  assert.equal(await read(root, 'design-pal/other.txt'), '另一工具');
  assert.equal((await projectStatus(root)).status, 'draft');
  assert.equal(await read(root, 'design-pal-codex/vendor/0.1.0-test.1/src/index.mjs'), await read(release, 'src/index.mjs'));
  await assert.rejects(planAdoption(release, root, choice), /同名/);
});

test('未知库、跨库配色与非法模式被拒绝', async () => {
  const root = await target();
  for (const selection of [{ ...choice, library: 'missing' }, { ...choice, color: 'amber' }, { ...choice, mode: 'auto' }]) await assert.rejects(planAdoption(release, root, selection), /配色/);
});

test('符号链接目录与登记路径逃逸被拒绝', async () => {
  const root = await target();
  await fs.symlink(root, path.join(sandbox, 'target-link'));
  await assert.rejects(planAdoption(release, path.join(sandbox, 'target-link'), choice), /符号链接/);
  await adopt(root);
  await fs.symlink(path.join(release, 'LICENSE'), path.join(root, 'linked.txt'));
  await assert.rejects(planConfirmation(root, ['linked.txt']), /符号链接/);
  await assert.rejects(planConfirmation(root, ['../private.txt']), /路径/);
  await assert.rejects(planConfirmation(root, ['.env']), /隐藏/);
  await assert.rejects(planCustomization(root, 'button', '../../outside.js', 'x'), /路径/);
});

test('定制仅影响单个项目；明确记录所替代组件', async () => {
  const a = await target(), b = await target();
  await adopt(a); await adopt(b);
  const plan = await planCustomization(a, 'button', 'button.css', '.custom { color: red; }');
  await customizeProject(a, 'button', 'button.css', '.custom { color: red; }', plan.digest);
  const selection = JSON.parse(await read(a, 'design-pal-codex/selection.json'));
  assert.equal(selection.customizations[0].component, 'button');
  await assert.rejects(read(b, 'design-pal-codex/custom/button.css'), /ENOENT/);
  assert.equal(await read(a, 'design-pal-codex/vendor/0.1.0-test.1/src/index.mjs'), await read(b, 'design-pal-codex/vendor/0.1.0-test.1/src/index.mjs'));
});

test('完整确认包含页面、资源、定制；内容变化自动显示草稿', async () => {
  const root = await target();
  await confirmed(root);
  assert.equal((await projectStatus(root)).status, 'confirmed');
  assert.equal(JSON.parse(await read(root, 'design-pal-codex/selection.json')).status, 'confirmed');
  await write(root, 'resource.css', 'p { color: blue; }');
  const status = await projectStatus(root);
  assert.equal(status.status, 'draft');
  assert.ok(status.changed.includes('resource.css'));
  const restore = await planRestore(root);
  assert.ok(restore.conflicts.includes('resource.css'));
  await assert.rejects(restoreProject(root, undefined, restore.digest), /冲突/);
});

test('确认计划后页面变化拒绝确认；缺文件不能确认', async () => {
  const root = await target(); await adopt(root);
  await write(root, 'page.html', 'first');
  const plan = await planConfirmation(root, ['page.html']);
  await write(root, 'page.html', 'second');
  await assert.rejects(confirmProject(root, ['page.html'], plan.digest), /变化/);
  await assert.rejects(planConfirmation(root, ['missing.html']), /缺失/);
});

test('登记草稿后可恢复页面资源与定制，删除新增草稿并保留业务与备份', async () => {
  const root = await target(); await confirmed(root);
  await write(root, 'business.txt', '后续业务变更');
  await write(root, 'page.html', '未完成页面');
  await write(root, 'resource.css', 'unfinished');
  const custom = await planCustomization(root, 'button', 'button.css', 'draft');
  await customizeProject(root, 'button', 'button.css', 'draft', custom.digest);
  // 定制不能顺便吞掉其他文件的外部修改冲突。
  assert.ok((await planRestore(root)).conflicts.includes('page.html'));
  const draft = await planDraft(root);
  await recordDraft(root, [], draft.digest);
  const plan = await planRestore(root);
  assert.deepEqual(plan.conflicts, []);
  const result = await restoreProject(root, undefined, plan.digest);
  assert.equal(await read(root, 'page.html'), '<p>已确认页面</p>');
  assert.equal(await read(root, 'resource.css'), 'p { color: red; }');
  assert.equal(await read(root, 'business.txt'), '后续业务变更');
  await assert.rejects(read(root, 'design-pal-codex/custom/button.css'), /ENOENT/);
  assert.equal(await read(root, `${result.backup}/files/page.html`), '未完成页面');
  assert.equal((await projectStatus(root)).status, 'confirmed');
});

test('恢复计划后出现新修改会拒绝覆盖', async () => {
  const root = await target(); await confirmed(root);
  const plan = await planRestore(root);
  await write(root, 'page.html', 'later');
  await assert.rejects(restoreProject(root, undefined, plan.digest), /变化/);
  assert.equal(await read(root, 'page.html'), 'later');
});

test('采用写入中断只留下临时记录，不留下看似成功的采用', async () => {
  const root = await target();
  const plan = await planAdoption(release, root, choice);
  await assert.rejects(applyAdoption(release, root, choice, plan.digest, { failAfter: 2 }), /中断/);
  const names = await fs.readdir(root);
  assert.equal(names.length, 1);
  assert.ok(names[0].startsWith('.design-pal-codex-adopt-'));
  assert.equal(JSON.parse(await read(root, `${names[0]}/operation.json`)).state, 'pending');
  await assert.rejects(read(root, 'design-pal-codex/selection.json'), /ENOENT/);
  await adopt(root);
  assert.equal((await projectStatus(root)).status, 'draft');
});

test('恢复写入中断保留备份与确认；精确确认后继续，第三方变更阻塞继续', async () => {
  const root = await target(); await confirmed(root);
  await write(root, 'page.html', 'draft');
  const draft = await planDraft(root); await recordDraft(root, [], draft.digest);
  const plan = await planRestore(root);
  await assert.rejects(restoreProject(root, undefined, plan.digest, { failAfter: 1 }), /中断/);
  await assert.rejects(projectStatus(root), /未完成恢复/);
  const pending = await planRecovery(root);
  await write(root, 'page.html', 'external');
  await assert.rejects(recoverProject(root, pending.digest), /变化/);
  const conflict = await planRecovery(root);
  await assert.rejects(recoverProject(root, conflict.digest), /外部修改/);
  await write(root, 'page.html', 'draft');
  const retry = await planRecovery(root);
  const result = await recoverProject(root, retry.digest);
  assert.equal(await read(root, `${result.backup}/files/page.html`), 'draft');
  assert.equal((await projectStatus(root)).status, 'confirmed');
});

test('确认快照损坏会拒绝恢复', async () => {
  const root = await target(); const saved = await confirmed(root);
  await write(root, `design-pal-codex/confirmed/${saved.id}/files/page.html`, 'tampered');
  await assert.rejects(planRestore(root), /快照损坏/);
  await assert.rejects(projectStatus(root), /快照损坏/);
});

test('固定发行损坏会阻塞后续使用，不包装为成功', async () => {
  const root = await target(); await adopt(root);
  await write(root, 'design-pal-codex/vendor/0.1.0-test.1/src/index.mjs', 'tampered');
  await assert.rejects(projectStatus(root), /修改/);
});


test('采用落地中断拒绝使用；恢复计划可完成且保持外部文件', async () => {
  const root = await target();
  await write(root, 'business.txt', '业务');
  const plan = await planAdoption(release, root, choice);
  await assert.rejects(applyAdoption(release, root, choice, plan.digest, { failPublishAfter: 2 }), /落地中断/);
  await assert.rejects(projectStatus(root), /尚未完成/);
  const recovery = await planRecovery(root);
  await recoverProject(root, recovery.digest);
  assert.equal((await projectStatus(root)).status, 'draft');
  assert.equal(await read(root, 'business.txt'), '业务');
});

test('新版真实改变资源，旧项目仍固定；升级需精确确认且可恢复旧版', async () => {
  const root = await target(); await confirmed(root);
  const next = path.join(sandbox, 'release-next');
  await createRelease({ output: next, version: '0.1.0-test.2' });
  const changed = 'src/index.mjs';
  await fs.appendFile(path.join(next, changed), '\nexport const fixtureUpgrade = true;\n');
  const manifest = JSON.parse(await read(next, 'release.json'));
  manifest.files.find(file => file.path === changed).sha256 = createHash('sha256').update(await fs.readFile(path.join(next, changed))).digest('hex');
  await write(next, 'release.json', JSON.stringify(manifest));
  assert.equal((await projectStatus(root)).version, '0.1.0-test.1');
  assert.ok(!(await read(root, 'design-pal-codex/vendor/0.1.0-test.1/src/index.mjs')).includes('fixtureUpgrade'));
  const plan = await planUpgrade(next, root, choice);
  assert.ok(plan.changes.includes(changed));
  await assert.rejects(upgradeProject(next, root, { ...choice, mode: 'dark' }, plan.digest), /变化/);
  await upgradeProject(next, root, choice, plan.digest);
  assert.equal((await projectStatus(root)).version, '0.1.0-test.2');
  assert.equal((await projectStatus(root)).status, 'draft');
  assert.ok((await read(root, 'design-pal-codex/vendor/0.1.0-test.2/src/index.mjs')).includes('fixtureUpgrade'));
  const restore = await planRestore(root);
  await restoreProject(root, undefined, restore.digest);
  assert.equal((await projectStatus(root)).version, '0.1.0-test.1');
  assert.equal((await projectStatus(root)).status, 'confirmed');
  assert.ok((await read(root, 'design-pal-codex/vendor/0.1.0-test.2/src/index.mjs')).includes('fixtureUpgrade'));
});

test('选用记录伪造无效配色会阻塞使用', async () => {
  const root = await target(); await adopt(root);
  const selection = JSON.parse(await read(root, 'design-pal-codex/selection.json'));
  await write(root, 'design-pal-codex/selection.json', JSON.stringify({ ...selection, color: 'missing' }));
  await assert.rejects(projectStatus(root), /配色/);
});

test('采用拒绝写入发行目录自身', async () => {
  await assert.rejects(planAdoption(release, release, choice), /发行目录内/);
});

test('首次采用保持未确认草稿，但不误报未经改动的文件', async () => {
  const root = await target();
  await adopt(root);
  const initial = await projectStatus(root);
  assert.equal(initial.status, 'draft');
  assert.equal(initial.confirmed, null);
  assert.deepEqual(initial.changed, []);
  await write(root, 'design-pal-codex/custom/README.md', '已修改定制说明');
  assert.deepEqual((await projectStatus(root)).changed, ['design-pal-codex/custom/README.md']);
});

test('旧格式项目可使用新版工具升级，并恢复原有确认页面', async () => {
  const old = path.join(sandbox, 'release-legacy');
  await createRelease({ output: old, version: '0.1.0-legacy.1' });
  const manifest = JSON.parse(await read(old, 'release.json'));
  manifest.format = 1;
  manifest.files = manifest.files.filter(file => file.path !== 'README.zh-CN.md');
  await fs.rm(path.join(old, 'README.zh-CN.md'));
  await write(old, 'release.json', JSON.stringify(manifest));
  const root = await target();
  await adopt(root, old);
  await write(root, 'page.html', '<p>旧版已确认页面</p>');
  const confirmation = await planConfirmation(root, ['page.html']);
  await confirmProject(root, ['page.html'], confirmation.digest);
  const upgrade = await planUpgrade(release, root, choice);
  await upgradeProject(release, root, choice, upgrade.digest);
  assert.equal((await projectStatus(root)).version, '0.1.0-test.1');
  const restore = await planRestore(root);
  await restoreProject(root, undefined, restore.digest);
  assert.equal((await projectStatus(root)).version, '0.1.0-legacy.1');
  assert.equal((await projectStatus(root)).status, 'confirmed');
  assert.equal(await read(root, 'page.html'), '<p>旧版已确认页面</p>');
});
