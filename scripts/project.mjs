import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRelease } from './release.mjs';

const AREA = 'design-pal-codex';
const SELECTION = `${AREA}/selection.json`;
const STATE = `${AREA}/state.json`;
const CUSTOM = `${AREA}/custom`;
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const digestPlan = value => ({ ...value, digest: hash(JSON.stringify(value)) });

function relative(value) {
  if (typeof value !== 'string' || !value || /[\\:\x00-\x1f]/.test(value) || path.posix.isAbsolute(value) || value.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('拒绝不安全的文件路径');
  return value;
}
async function rootPath(value) {
  const absolute = path.resolve(value);
  // 连父目录的链接也拒绝，防止用户看到的目标与真正写入的位置不一致。
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = await fs.lstat(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('目标及其父目录必须是真实目录，不能使用符号链接');
  }
  return absolute;
}
async function safePath(root, rel) {
  relative(rel);
  let cursor = root;
  const parts = rel.split('/');
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) throw new Error('拒绝符号链接或非目录父路径');
    } catch (error) { if (error.code === 'ENOENT') break; throw error; }
  }
  return path.join(root, rel);
}
async function read(root, rel) { return fs.readFile(await safePath(root, rel)); }
async function readJSON(root, rel) { return JSON.parse(await read(root, rel)); }
async function currentHash(root, rel) {
  try { return hash(await read(root, rel)); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function write(root, rel, value) {
  const target = await safePath(root, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await safePath(root, rel);
  const temp = `${target}.design-pal-codex-${randomUUID()}`;
  await fs.writeFile(temp, value, { flag: 'wx' });
  await fs.rename(temp, target);
}
async function tree(root, rel = '') {
  const entries = await fs.readdir(rel ? await safePath(root, rel) : root, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('文件树中不允许符号链接');
    if (entry.isDirectory()) result.push(...await tree(root, next));
    else if (entry.isFile()) result.push(next);
    else throw new Error('只允许普通文件和目录');
  }
  return result;
}
async function records(root, names) {
  const result = [];
  for (const name of [...new Set(names)].sort()) result.push({ path: relative(name), sha256: await currentHash(root, name) });
  return result;
}
function checked(plan, digest) { if (!digest || digest !== plan.digest) throw new Error('计划内容已变化或未经精确确认，请重新查看计划并确认'); }
function managed(rel) {
  relative(rel);
  if (rel === SELECTION || rel.startsWith(`${CUSTOM}/`)) return rel;
  if (rel.split('/').some(part => part.startsWith('.')) || rel === AREA || rel.startsWith(`${AREA}/`)) throw new Error('不能登记隐藏文件或工具内部记录');
  return rel;
}
async function project(target) {
  const root = await rootPath(target);
  try { await fs.lstat(await safePath(root, `${AREA}/pending-adoption.json`)); throw new Error('采用尚未完成，保留的中断记录需要先处理'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const selection = await readJSON(root, SELECTION);
  const state = await readJSON(root, STATE);
  if (selection.project !== AREA || state.project !== AREA) throw new Error('不是本工具创建的采用记录');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+-]*$/.test(selection.version) || !Array.isArray(state.observed)) throw new Error('项目记录无效');
  for (const file of state.observed) managed(file.path);
  const release = await verifyRelease(await safePath(root, `${AREA}/vendor/${selection.version}`));
  if (release.version !== selection.version) throw new Error('固定版本与选用记录不一致');
  selectionValid(release, selection);
  if (state.recovery) throw new Error(`存在未完成恢复，请先执行 recover：${state.recovery}`);
  return { root, selection, state };
}
function selectionValid(release, selection) {
  if (!release.libraries?.find(item => item.id === selection.library)?.colors.some(item => item.id === selection.color) || !['light', 'dark'].includes(selection.mode)) throw new Error('库、配色或亮暗模式不属于发行内容');
}
export async function planAdoption(releaseRoot, targetRoot, selection) {
  const source = await rootPath(releaseRoot);
  const target = await rootPath(targetRoot);
  if (target === source || target.startsWith(`${source}${path.sep}`)) throw new Error('目标项目不能位于固定发行目录内');
  const release = await verifyRelease(source);
  selectionValid(release, selection);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+-]*$/.test(release.version)) throw new Error('发行版本名称不安全');
  try { await fs.lstat(await safePath(target, AREA)); throw new Error('目标已有同名采用记录，拒绝覆盖'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = await records(source, await tree(source));
  return digestPlan({ action: 'adopt', source, target, version: release.version, selection: { library: selection.library, color: selection.color, mode: selection.mode }, release: files, additions: [SELECTION, STATE, `${CUSTOM}/README.md`, `${AREA}/handoff.md`, ...files.map(file => `${AREA}/vendor/${release.version}/${file.path}`)], impact: '复制固定版本及项目专用定制目录；不修改现有业务文件。采用后仍为待确认草稿。' });
}
export async function applyAdoption(releaseRoot, targetRoot, selection, digest, options = {}) {
  const plan = await planAdoption(releaseRoot, targetRoot, selection);
  checked(plan, digest);
  const staging = `.design-pal-codex-adopt-${randomUUID()}`;
  await fs.mkdir(path.join(plan.target, staging));
  const stageRoot = path.join(plan.target, staging);
  await write(stageRoot, 'operation.json', json({ action: 'adopt', state: 'pending', digest, target: AREA }));
  let count = 0;
  for (const file of plan.release) {
    const data = await read(plan.source, file.path);
    if (hash(data) !== file.sha256) throw new Error('复制期间发行内容变化，采用未完成');
    await write(stageRoot, `${AREA}/vendor/${plan.version}/${file.path}`, data);
    if (++count === options.failAfter) throw new Error(`模拟采用中断；临时记录保留在 ${staging}`);
  }
  await verifyRelease(path.join(stageRoot, AREA, 'vendor', plan.version));
  const selected = { project: AREA, format: 1, version: plan.version, ...plan.selection, previewDigest: digest, status: 'draft', confirmed: null, customizations: [] };
  await write(stageRoot, SELECTION, json(selected));
  await write(stageRoot, `${CUSTOM}/README.md`, '# 本项目定制\n\n仅在此保存本项目定制。用 customize 登记所替代组件；不修改固定发行。\n');
  const observed = await records(stageRoot, [SELECTION, `${CUSTOM}/README.md`]);
  await write(stageRoot, STATE, json({ project: AREA, format: 1, observed, confirmed: null, recovery: null }));
  await write(stageRoot, `${AREA}/handoff.md`, '# 项目交接\n\n已复制选定的固定发行，当前为草稿，尚未确认页面。先阅读 selection.json，再使用 vendor 中的固定组件与说明；页面、必要资源和配置一并登记后确认。\n');
  // 第二次检查目标，避免计划后出现的同名内容被替换。
  try { await fs.lstat(path.join(plan.target, AREA)); throw new Error('采用期间出现同名目录，拒绝覆盖'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // 独占创建目标，哪怕并发出现空目录也拒绝覆盖。发布期间保留中断标记。
  await fs.mkdir(path.join(plan.target, AREA));
  const expected = await records(stageRoot, await tree(stageRoot, AREA));
  await write(plan.target, `${AREA}/pending-adoption.json`, json({ staging, digest, status: 'pending', expected }));
  let published = 0;
  for (const name of await fs.readdir(path.join(stageRoot, AREA))) {
    await fs.rename(path.join(stageRoot, AREA, name), path.join(plan.target, AREA, name));
    if (++published === options.failPublishAfter) throw new Error('模拟采用落地中断；目标中断记录与临时目录已保留');
  }
  await fs.rm(path.join(plan.target, AREA, 'pending-adoption.json'));
  await fs.rm(stageRoot, { recursive: true });
  return { status: 'draft', version: plan.version, target: plan.target };
}
export async function planUpgrade(releaseRoot, targetRoot, selection) {
  const { root, selection: previous, state } = await project(targetRoot);
  const source = await rootPath(releaseRoot);
  const release = await verifyRelease(source);
  selectionValid(release, selection);
  if (release.version === previous.version) throw new Error('升级必须使用新的发行版本');
  const destination = `${AREA}/vendor/${relative(release.version)}`;
  try { await fs.lstat(await safePath(root, destination)); throw new Error('目标已保存此版本，拒绝覆盖固定发行'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = await records(source, await tree(source));
  const old = await verifyRelease(await safePath(root, `${AREA}/vendor/${previous.version}`));
  const changes = files.filter(file => !old.files.some(item => item.path === file.path && item.sha256 === file.sha256)).map(file => file.path);
  const removed = old.files.filter(file => !files.some(item => item.path === file.path)).map(file => file.path);
  return digestPlan({ action: 'upgrade', source, target: root, previous, version: release.version, selection: { library: selection.library, color: selection.color, mode: selection.mode }, release: files, changes, removed, stateDigest: hash(json(state)), impact: '新增固定发行并切换选用记录，页面仍需按新版本调整和验证；保留旧版与历史确认，当前成果变为草稿。' });
}
export async function upgradeProject(releaseRoot, targetRoot, selection, digest, options = {}) {
  const plan = await planUpgrade(releaseRoot, targetRoot, selection); checked(plan, digest);
  const { root, state } = await project(targetRoot);
  const stage = `${AREA}/vendor/.upgrade-${randomUUID()}`;
  await fs.mkdir(await safePath(root, stage));
  let count = 0;
  for (const file of plan.release) {
    const data = await read(plan.source, file.path);
    if (hash(data) !== file.sha256) throw new Error('升级期间发行内容变化，旧版选用保持');
    await write(root, `${stage}/${file.path}`, data);
    if (++count === options.failAfter) throw new Error('模拟升级中断；旧版选用保持，临时文件保留');
  }
  await verifyRelease(await safePath(root, stage));
  const destination = `${AREA}/vendor/${plan.version}`;
  // 先独占占位再搬入文件，选用记录只在完整校验之后切换。
  await fs.mkdir(await safePath(root, destination));
  for (const name of await fs.readdir(await safePath(root, stage))) await fs.rename(await safePath(root, `${stage}/${name}`), await safePath(root, `${destination}/${name}`));
  await fs.rmdir(await safePath(root, stage));
  await verifyRelease(await safePath(root, destination));
  await write(root, SELECTION, json({ ...plan.previous, ...plan.selection, version: plan.version, status: 'draft', previewDigest: digest }));
  const selected = (await records(root, [SELECTION]))[0];
  await write(root, STATE, json({ ...state, observed: state.observed.map(file => file.path === SELECTION ? selected : file) }));
  return { status: 'draft', previous: plan.previous.version, version: plan.version };
}
export async function projectStatus(target) {
  const { root, selection, state } = await project(target);
  const names = [...state.observed.map(file => file.path), ...await tree(root, CUSTOM)];
  const current = await records(root, names);
  const confirmation = state.confirmed ? await snapshot(root, state.confirmed) : null;
  const expected = confirmation?.files || state.observed;
  const changed = current.filter(file => !expected.some(old => old.path === file.path && old.sha256 === file.sha256)).map(file => file.path);
  const missing = expected.filter(file => !current.some(now => now.path === file.path && now.sha256 === file.sha256)).map(file => file.path);
  const status = confirmation && !changed.length && !missing.length ? 'confirmed' : 'draft';
  return { status, version: selection.version, confirmed: state.confirmed, changed: [...new Set([...changed, ...missing])], selection: { ...selection, status } };
}
export async function planConfirmation(target, paths) {
  const { root, selection, state } = await project(target);
  if (!Array.isArray(paths) || !paths.some(name => !name.startsWith(`${AREA}/`))) throw new Error('至少登记一个项目页面，并一并登记页面需要的资源与配置');
  const names = [SELECTION, ...paths.map(managed), ...await tree(root, CUSTOM)];
  const files = await records(root, names);
  if (files.some(file => file.sha256 === null)) throw new Error('登记文件缺失，不能确认');
  return digestPlan({ action: 'confirm', target: root, version: selection.version, previous: state.confirmed, files, stateDigest: hash(json(state)), impact: '将登记页面、资源、配置、项目定制与选用记录保存为新的确认快照。未登记的业务文件不在恢复范围。' });
}
export async function confirmProject(target, paths, digest) {
  const plan = await planConfirmation(target, paths); checked(plan, digest);
  const { root, selection, state } = await project(target);
  const id = randomUUID();
  const selectedData = Buffer.from(json({ ...selection, status: 'confirmed', confirmed: id }));
  const savedFiles = plan.files.map(file => file.path === SELECTION ? { ...file, sha256: hash(selectedData) } : file);
  const location = `${AREA}/confirmed/${id}`;
  // 先完整保存快照，再更新当前选用与确认索引；旧快照始终保留。
  for (const file of plan.files) {
    const data = await read(root, file.path);
    if (hash(data) !== file.sha256) throw new Error('确认期间文件变化，旧确认仍保留');
    await write(root, `${location}/files/${file.path}`, file.path === SELECTION ? selectedData : data);
  }
  await write(root, `${location}/snapshot.json`, json({ project: AREA, format: 1, id, files: savedFiles, planDigest: digest }));
  await write(root, SELECTION, selectedData);
  await write(root, STATE, json({ ...state, observed: savedFiles, confirmed: id }));
  await write(root, `${AREA}/handoff.md`, `# 项目交接\n\n最近确认：${id}。后续修改仍为草稿；先运行 status 检查，再记录草稿或确认新的页面。恢复只影响登记文件。\n`);
  return { status: 'confirmed', id, files: savedFiles };
}
export async function planDraft(target, paths = []) {
  const { root, state } = await project(target);
  const files = await records(root, [...state.observed.map(item => item.path), ...paths.map(managed), ...await tree(root, CUSTOM)]);
  return digestPlan({ action: 'record-draft', target: root, files, stateDigest: hash(json(state)), impact: '将当前登记文件记为可丢弃的草稿基线；保留最近确认版本。请先审阅，登记后恢复可以覆盖这些草稿。' });
}
export async function recordDraft(target, paths, digest) {
  const plan = await planDraft(target, paths); checked(plan, digest);
  const { root, state } = await project(target);
  await write(root, STATE, json({ ...state, observed: plan.files }));
  return { status: 'draft', files: plan.files };
}
export async function planCustomization(target, component, filename, content) {
  const { root, selection, state } = await project(target);
  if (typeof component !== 'string' || !component.trim()) throw new Error('必须说明定制所替代的组件');
  relative(filename);
  const rel = `${CUSTOM}/${filename}`;
  const previous = await currentHash(root, rel);
  return digestPlan({ action: 'customize', target: root, component, path: rel, sha256: hash(content), previous, selectionDigest: hash(json(selection)), stateDigest: hash(json(state)), impact: '仅更新当前项目定制；页面须显式引用该定制，其他项目和固定发行保持原样。' });
}
export async function customizeProject(target, component, filename, content, digest) {
  const plan = await planCustomization(target, component, filename, content); checked(plan, digest);
  const { root, selection, state } = await project(target);
  await write(root, plan.path, content);
  await write(root, SELECTION, json({ ...selection, status: 'draft', customizations: [...selection.customizations.filter(item => item.path !== plan.path), { component, path: plan.path }] }));
  const changed = await records(root, [SELECTION, plan.path]);
  await write(root, STATE, json({ ...state, observed: [...state.observed.filter(file => !changed.some(item => item.path === file.path)), ...changed].sort((a, b) => a.path.localeCompare(b.path)) }));
  return { status: 'draft', path: plan.path };
}
async function snapshot(root, id) {
  relative(id);
  if (id.includes('/')) throw new Error('确认标识无效');
  const data = await readJSON(root, `${AREA}/confirmed/${id}/snapshot.json`);
  if (data.project !== AREA || data.id !== id || !Array.isArray(data.files)) throw new Error('确认记录无效');
  for (const file of data.files) {
    managed(file.path);
    if (hash(await read(root, `${AREA}/confirmed/${id}/files/${file.path}`)) !== file.sha256) throw new Error('确认快照损坏，拒绝恢复');
  }
  return data;
}
export async function planRestore(target, confirmation) {
  const { root, state } = await project(target);
  const id = confirmation || state.confirmed;
  if (!id) throw new Error('没有可恢复的确认版本');
  const saved = await snapshot(root, id);
  const selected = await readJSON(root, `${AREA}/confirmed/${id}/files/${SELECTION}`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+-]*$/.test(selected.version)) throw new Error('确认快照版本无效');
  const previousRelease = await verifyRelease(await safePath(root, `${AREA}/vendor/${selected.version}`));
  selectionValid(previousRelease, selected);
  const files = await records(root, [...state.observed.map(file => file.path), ...saved.files.map(file => file.path), ...await tree(root, CUSTOM)]);
  const conflicts = files.filter(file => file.sha256 !== (state.observed.find(old => old.path === file.path)?.sha256 ?? null)).map(file => file.path);
  return digestPlan({ action: 'restore', target: root, confirmation: id, before: files, after: saved.files, stateDigest: hash(json(state)), conflicts, impact: '恢复登记文件；新增草稿文件将删除；先备份当前内容。未登记的业务文件保持原样。冲突须先审阅并登记草稿。' });
}
export async function restoreProject(target, confirmation, digest, options = {}) {
  const plan = await planRestore(target, confirmation); checked(plan, digest);
  if (plan.conflicts.length) throw new Error(`存在外部修改冲突：${plan.conflicts.join('、')}`);
  const { root, state } = await project(target);
  const id = randomUUID();
  const base = `${AREA}/backups/${id}`;
  for (const file of plan.before) if (file.sha256 !== null) {
    const data = await read(root, file.path);
    if (hash(data) !== file.sha256) throw new Error('备份期间文件变化，恢复尚未开始');
    await write(root, `${base}/files/${file.path}`, data);
  }
  const journal = { project: AREA, format: 1, id, status: 'pending', confirmation: plan.confirmation, before: plan.before, after: plan.after, stateBefore: state };
  await write(root, `${base}/operation.json`, json(journal));
  await write(root, STATE, json({ ...state, recovery: id }));
  return finishRecovery(root, journal, options);
}
async function finishRecovery(root, journal, options = {}) {
  const desired = journal.after;
  const base = `${AREA}/backups/${journal.id}`;
  await snapshot(root, journal.confirmation);
  const names = [...new Set([...journal.before.map(file => file.path), ...desired.map(file => file.path)])].sort();
  // 对每个文件检查其内容仍处于恢复前或恢复后的状态；第三种状态说明有新的外部修改。
  for (const name of names) {
    const actual = await currentHash(root, name);
    const before = journal.before.find(file => file.path === name)?.sha256 ?? null;
    const after = desired.find(file => file.path === name)?.sha256 ?? null;
    if (actual !== before && actual !== after) throw new Error(`恢复中发现外部修改：${name}；备份与中断记录已保留`);
  }
  let count = 0;
  for (const name of names) {
    const file = desired.find(item => item.path === name);
    if (file) await write(root, name, await read(root, `${AREA}/confirmed/${journal.confirmation}/files/${name}`));
    else await fs.rm(await safePath(root, name), { force: true });
    if (++count === options.failAfter) throw new Error(`模拟恢复中断，使用 recover 继续：${journal.id}`);
  }
  await write(root, STATE, json({ ...journal.stateBefore, observed: desired, confirmed: journal.confirmation, recovery: null }));
  await write(root, `${base}/operation.json`, json({ ...journal, status: 'complete' }));
  return { status: 'confirmed', confirmation: journal.confirmation, backup: base };
}
async function pendingAdoption(root) {
  try { return await readJSON(root, `${AREA}/pending-adoption.json`); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function adoptionRecoveryPlan(root, pending) {
  if (!/^\.design-pal-codex-adopt-[a-f0-9-]+$/.test(pending.staging) || !Array.isArray(pending.expected)) throw new Error('采用中断记录无效');
  const stageRoot = await rootPath(path.join(root, pending.staging));
  const current = [];
  for (const file of pending.expected) {
    relative(file.path);
    if (!file.path.startsWith(`${AREA}/`)) throw new Error('采用中断路径无效');
    const active = await currentHash(root, file.path);
    const staged = await currentHash(stageRoot, file.path);
    if ((active !== null && staged !== null) || (active ?? staged) !== file.sha256) throw new Error('中断采用内容被修改或重复，拒绝继续');
    current.push({ path: file.path, sha256: active ?? staged, location: active === null ? 'staging' : 'target' });
  }
  const expected = new Set(pending.expected.map(file => file.path));
  const activeFiles = (await tree(root, AREA)).filter(name => name !== `${AREA}/pending-adoption.json`);
  const stageFiles = await tree(stageRoot, AREA);
  if ([...activeFiles, ...stageFiles].some(name => !expected.has(name))) throw new Error('中断采用包含计划外文件，拒绝继续');
  return digestPlan({ action: 'recover-adoption', target: root, staging: pending.staging, pendingDigest: hash(json(pending)), current, impact: '继续完成先前已经确认的采用；如中断内容被修改则拒绝。' });
}
export async function planRecovery(target) {
  const root = await rootPath(target);
  const adoption = await pendingAdoption(root);
  if (adoption) return adoptionRecoveryPlan(root, adoption);
  const state = await readJSON(root, STATE);
  if (!state.recovery) throw new Error('没有未完成恢复');
  const id = relative(state.recovery);
  if (id.includes('/')) throw new Error('恢复标识无效');
  const journal = await readJSON(root, `${AREA}/backups/${id}/operation.json`);
  if (journal.project !== AREA || journal.id !== id || journal.status !== 'pending') throw new Error('恢复记录不匹配');
  for (const file of [...journal.before, ...journal.after]) managed(file.path);
  await snapshot(root, journal.confirmation);
  return digestPlan({ action: 'recover', target: root, recovery: id, journalDigest: hash(json(journal)), current: await records(root, journal.before.map(file => file.path)), impact: '从保留的确认快照继续未完成恢复，遇到新的外部修改会停止；恢复前备份仍保留。' });
}
export async function recoverProject(target, digest) {
  const plan = await planRecovery(target); checked(plan, digest);
  if (plan.action === 'recover-adoption') {
    const stageRoot = await rootPath(path.join(plan.target, plan.staging));
    for (const name of await fs.readdir(await safePath(stageRoot, AREA))) {
      try { await fs.lstat(await safePath(plan.target, `${AREA}/${name}`)); throw new Error('中断采用目标存在冲突'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await fs.rename(await safePath(stageRoot, `${AREA}/${name}`), await safePath(plan.target, `${AREA}/${name}`));
    }
    const selection = await readJSON(plan.target, SELECTION);
    await verifyRelease(await safePath(plan.target, `${AREA}/vendor/${relative(selection.version)}`));
    await fs.rm(await safePath(plan.target, `${AREA}/pending-adoption.json`));
    await fs.rm(stageRoot, { recursive: true });
    return { status: 'draft', version: selection.version };
  }
  const journal = await readJSON(plan.target, `${AREA}/backups/${plan.recovery}/operation.json`);
  return finishRecovery(plan.target, journal);
}

async function cli(args) {
  const [command, ...rest] = args;
  const [target, digest, ...paths] = rest;
  const choice = { library: rest[2], color: rest[3], mode: rest[4] };
  switch (command) {
    case 'plan-adopt': return planAdoption(rest[0], rest[1], choice);
    case 'adopt': return applyAdoption(rest[0], rest[1], choice, rest[5]);
    case 'plan-upgrade': return planUpgrade(rest[0], rest[1], choice);
    case 'upgrade': return upgradeProject(rest[0], rest[1], choice, rest[5]);
    case 'status': return projectStatus(target);
    case 'plan-confirm': return planConfirmation(target, rest.slice(1));
    case 'confirm': return confirmProject(target, paths, digest);
    case 'plan-draft': return planDraft(target, rest.slice(1));
    case 'record-draft': return recordDraft(target, paths, digest);
    case 'plan-restore': return planRestore(target, rest[1]);
    case 'restore': return restoreProject(target, rest[2], digest);
    case 'plan-recover': return planRecovery(target);
    case 'recover': return recoverProject(target, digest);
    case 'plan-customize': return planCustomization(target, rest[1], rest[2], await fs.readFile(rest[3]));
    case 'customize': return customizeProject(target, rest[1], rest[2], await fs.readFile(rest[3]), rest[4]);
    default: throw new Error('用法见 PROJECT.md；支持 plan-adopt/adopt、plan-upgrade/upgrade、status、plan-confirm/confirm、plan-draft/record-draft、plan-customize/customize、plan-restore/restore、plan-recover/recover');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).then(result => process.stdout.write(json(result))).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
