import { lstat, stat, readdir, readFile, mkdir, mkdtemp, writeFile, rename, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyRelease } from './release.mjs';

const name = 'design-pal-codex';
const files = ['SKILL.md', 'agents/openai.yaml', 'references/workflow.md'];
const exists = async location => lstat(location).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});

async function noLinks(location) {
  for (let current = path.resolve(location);; current = path.dirname(current)) {
    const info = await exists(current);
    if (info?.isSymbolicLink()) throw new Error(`安装路径不能经过符号链接：${current}`);
    if (info && !info.isDirectory()) throw new Error(`安装路径必须是目录：${current}`);
    if (path.dirname(current) === current) break;
  }
}

// 技能可能以别的文件夹名称声明同名能力，也可能通过符号链接暴露。
async function sameName(root, visited = new Set()) {
  const info = await exists(root);
  if (!info) return null;
  const resolved = await realpath(root);
  if (visited.has(resolved)) return null;
  visited.add(resolved);
  const actual = await stat(root);
  if (!actual.isDirectory()) return null;
  const skill = path.join(root, 'SKILL.md');
  if (await exists(skill)) {
    const text = await readFile(skill, 'utf8');
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (front && /^name:\s*["']?design-pal-codex["']?\s*$/m.test(front[1])) return skill;
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      const found = await sameName(path.join(root, entry.name), visited);
      if (found) return found;
    }
  }
  return null;
}

function discoveryRoots(projectRoot, homeRoot, codexHome, systemSkillsRoot) {
  const roots = new Set([
    systemSkillsRoot,
    path.join(homeRoot, '.agents/skills'), path.join(codexHome, 'skills'),
    path.join(homeRoot, '.claude/skills'), path.join(codexHome, 'plugins/cache'),
    path.join(homeRoot, '.claude/plugins/cache'),
  ]);
  for (let current = projectRoot;; current = path.dirname(current)) {
    for (const relative of ['.agents/skills', '.codex/skills', '.claude/skills']) roots.add(path.join(current, relative));
    if (path.dirname(current) === current) break;
  }
  return [...roots];
}

export async function installSkills({ releaseRoot, projectRoot, host = 'both', scope = 'project', approvePersonal = false,
  homeRoot = os.homedir(), codexHome = process.env.CODEX_HOME || path.join(homeRoot, '.codex'),
  systemSkillsRoot = '/etc/codex/skills' } = {}) {
  if (!releaseRoot || !projectRoot) throw new Error('必须提供完整发行目录及已有目标项目');
  if (!['codex', 'claude', 'both'].includes(host)) throw new Error('宿主只能是 codex、claude 或 both');
  if (!['project', 'personal'].includes(scope)) throw new Error('范围只能是 project 或 personal');
  if (scope === 'personal' && approvePersonal !== true) throw new Error('个人范围安装需要用户明确批准及 --approve-personal 参数');
  releaseRoot = await realpath(releaseRoot);
  projectRoot = path.resolve(projectRoot);
  if (!(await exists(projectRoot))?.isDirectory()) throw new Error('目标项目必须是已有目录，不能是符号链接');
  projectRoot = await realpath(projectRoot);
  homeRoot = await realpath(homeRoot);
  const manifest = await verifyRelease(releaseRoot);
  const source = path.join(releaseRoot, 'skills', name);
  const entries = await Promise.all(files.map(async file => {
    const location = path.join(source, file);
    if (!(await lstat(location)).isFile()) throw new Error('技能源必须是普通文件');
    return [file, await readFile(location)];
  }));
  const base = scope === 'personal' ? homeRoot : projectRoot;
  const destinations = [];
  if (host !== 'claude') destinations.push(path.join(base, '.agents/skills', name));
  if (host !== 'codex') destinations.push(path.join(base, '.claude/skills', name));
  for (const destination of destinations) {
    await noLinks(path.dirname(destination));
    if (await exists(destination)) throw new Error(`已有同名技能，拒绝覆盖：${destination}`);
  }
  for (const root of discoveryRoots(projectRoot, homeRoot, codexHome, systemSkillsRoot)) {
    const conflict = await sameName(root);
    if (conflict) throw new Error(`宿主可见范围发现同名声明，拒绝安装：${conflict}`);
  }
  const staged = [];
  const installed = [];
  try {
    for (const destination of destinations) {
      await mkdir(path.dirname(destination), { recursive: true });
      const temporary = await mkdtemp(path.join(path.dirname(destination), '.design-pal-codex-install-'));
      staged.push(temporary);
      for (const [file, bytes] of entries) {
        await mkdir(path.dirname(path.join(temporary, file)), { recursive: true });
        await writeFile(path.join(temporary, file), bytes, { flag: 'wx' });
      }
      await writeFile(path.join(temporary, 'release-location.json'), JSON.stringify({
        format: 1, name, releaseRoot, version: manifest.version, scope,
      }, null, 2) + '\n', { flag: 'wx' });
    }
    for (let index = 0; index < destinations.length; index += 1) {
      const destination = destinations[index];
      // 先独占目标目录，避免 rename 覆盖在预检后出现的空目录。
      await mkdir(destination);
      installed.push(destination);
      for (const entry of await readdir(staged[index])) await rename(path.join(staged[index], entry), path.join(destination, entry));
    }
  } catch (error) {
    for (const destination of installed) await rm(destination, { recursive: true, force: true });
    throw error;
  } finally {
    for (const temporary of staged) await rm(temporary, { recursive: true, force: true });
  }
  return { name, scope, host, version: manifest.version, destinations };
}

async function main(args) {
  const [releaseRoot, projectRoot, ...options] = args;
  let host = 'both';
  let scope = 'project';
  let approvePersonal = false;
  for (let index = 0; index < options.length; index += 1) {
    if (['--host', '--scope'].includes(options[index]) && (!options[index + 1] || options[index + 1].startsWith('--'))) throw new Error('安装参数缺少值，未执行安装');
    if (options[index] === '--host') host = options[++index];
    else if (options[index] === '--scope') scope = options[++index];
    else if (options[index] === '--approve-personal') approvePersonal = true;
    else throw new Error(`未知参数：${options[index]}`);
  }
  return installSkills({ releaseRoot, projectRoot, host, scope, approvePersonal });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
