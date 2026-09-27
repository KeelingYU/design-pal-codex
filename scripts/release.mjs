import { lstat, readdir, readFile, mkdir, mkdtemp, writeFile, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { requiredFiles, markerName } from './build.mjs';
import { startPreview } from './preview-server.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const releaseManifestName = 'release.json';
const versionPattern = /^\d+\.\d+\.\d+(?:-[a-z0-9]+(?:\.[a-z0-9]+)*)?$/;
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const documents = ['README.md', 'USAGE.md', 'FORMS.md', 'TABLE.md', 'NAVIGATION.md', 'FEEDBACK.md', 'RELEASE.md', 'LICENSE'];
function validPath(value) {
  return typeof value === 'string' && value.length > 0 && !/[\\:\x00-\x1f]/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..');
}
async function scan(root, relative = '') {
  const info = await lstat(path.join(root, relative));
  if (info.isSymbolicLink()) throw new Error('发行物不得包含符号链接');
  if (info.isFile()) return [relative];
  if (!info.isDirectory()) throw new Error('发行物不得包含特殊文件');
  const files = [];
  for (const name of (await readdir(path.join(root, relative))).sort()) files.push(...await scan(root, path.posix.join(relative, name)));
  return files;
}
async function safeRead(root, relative) {
  if (!validPath(relative)) throw new Error('发行路径无效');
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('发行物不得包含符号链接');
  }
  return readFile(current);
}
function minimumFiles() {
  return [...requiredFiles.map(file => `src/${file}`), ...documents, markerName,
    'catalog.json', 'package.json', 'scripts/release.mjs', 'scripts/build.mjs', 'scripts/preview-server.mjs',
    'scripts/export-public.mjs', 'scripts/project.mjs', 'scripts/install-skills.mjs',
    'PROJECT.md', 'SKILLS.md', 'EXAMPLES.md', 'skills/design-pal-codex/SKILL.md',
    'skills/design-pal-codex/agents/openai.yaml', 'skills/design-pal-codex/references/workflow.md',
    ...['index.html', 'baseline.html', 'page.css', 'page.mjs', 'baseline.mjs', 'model.mjs', 'serve.mjs'].map(file => `examples/acceptance/${file}`)];
}
export async function verifyRelease(root) {
  const actual = await scan(root);
  const manifest = JSON.parse(await safeRead(root, releaseManifestName));
  if (manifest.project !== 'design-pal-codex' || manifest.format !== 1 || !versionPattern.test(manifest.version)
    || !Array.isArray(manifest.files) || !manifest.files.every(entry => validPath(entry.path) && /^[a-f0-9]{64}$/.test(entry.sha256))
    || new Set(manifest.files.map(entry => entry.path.toLowerCase())).size !== manifest.files.length) throw new Error('发行清单无效');
  const names = manifest.files.map(entry => entry.path);
  if (minimumFiles().some(file => !names.includes(file))) throw new Error('发行缺少必需文件');
  if (actual.length !== names.length + 1 || actual.some(file => file !== releaseManifestName && !names.includes(file))) throw new Error('发行包含清单外文件或缺少文件');
  for (const entry of manifest.files) {
    if (hash(await safeRead(root, entry.path)) !== entry.sha256) throw new Error(`发行文件被修改：${entry.path}`);
  }
  // 检查页面与组件引用的本地资源，防止遗漏资源仍被当成完整发行。
  for (const name of names.filter(file => file.startsWith('src/') && /\.(?:mjs|js|css|html)$/.test(file))) {
    const text = (await safeRead(root, name)).toString('utf8');
    const references = name.endsWith('.html') ? [...text.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      : name.endsWith('.css') ? [...text.matchAll(/(?:@import\s+["']|url\(["']?)([^"')]+)["']?\)?/g)]
      : [...text.matchAll(/(?:from\s*|import\s*\(?)["'](\.[^"']+)["']/g)];
    for (const [, reference] of references) {
      if (/^(?:[a-z]+:|#|\/)/i.test(reference)) continue;
      const resource = path.posix.normalize(path.posix.join(path.posix.dirname(name), reference.split(/[?#]/)[0]));
      if (!names.includes(resource)) throw new Error(`发行引用的资源缺失：${resource}`);
    }
  }
  const catalog = JSON.parse(await safeRead(root, 'catalog.json'));
  if (catalog.length !== 3 || new Set(catalog.map(item => item.id)).size !== 3
    || catalog.some(item => item.colors?.length !== 2 || item.colors.some(color => !color.light || !color.dark))
    || JSON.stringify(catalog) !== JSON.stringify(manifest.libraries)) throw new Error('发行必须包含三库六色及亮暗模式');
  for (const library of catalog) for (const color of library.colors) {
    if (!names.includes(`src/preview/previews/${library.id}-${color.id}.jpg`)) throw new Error('发行缺少配色真实预览图片');
  }
  const build = JSON.parse(await safeRead(root, markerName));
  if (build.project !== manifest.project || build.format !== 1 || JSON.stringify(build.files) !== JSON.stringify(names.filter(file => file.startsWith('src/')))) throw new Error('预览资源清单不一致');
  return manifest;
}
export async function createRelease({ root = projectRoot, output, version } = {}) {
  if (!versionPattern.test(version ?? '')) throw new Error('需要有效且未使用的发行版本');
  root = await realpath(root);
  output ??= path.join(root, 'releases', version);
  output = path.resolve(output);
  await mkdir(path.dirname(output), { recursive: true });
  output = path.join(await realpath(path.dirname(output)), path.basename(output));
  if (await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error; return null; })) throw new Error('发行版本目录已存在，拒绝覆盖');
  // 逐文件白名单同时限制发行物，不把开发文档或运行记录放入包中。
  const whitelist = JSON.parse(await readFile(path.join(root, 'publishing/public-files.json')).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return readFile(path.join(root, 'release-files.json'));
  }));
  const selected = whitelist.files.filter(entry => entry.target.startsWith('src/')
    || documents.includes(entry.target) || ['PROJECT.md', 'SKILLS.md', 'EXAMPLES.md'].includes(entry.target)
    || entry.target.startsWith('skills/design-pal-codex/') || entry.target.startsWith('examples/acceptance/')
    || ['scripts/build.mjs', 'scripts/preview-server.mjs', 'scripts/export-public.mjs', 'scripts/release.mjs', 'scripts/project.mjs', 'scripts/install-skills.mjs'].includes(entry.target));
  const entries = [];
  const { exportPublic } = await import('./export-public.mjs');
  const audit = await mkdtemp(path.join(os.tmpdir(), 'design-pal-codex-release-audit-'));
  try {
    const prepared = path.join(audit, 'files');
    await exportPublic({ root, output: prepared, manifest: { ...whitelist, license: 'MIT', files: selected } });
    for (const entry of selected) entries.push({ path: entry.target, bytes: await safeRead(prepared, entry.target) });
  } finally { await rm(audit, { recursive: true, force: true }); }
  const catalogSource = entries.find(entry => entry.path === 'src/libraries/catalog.mjs')?.bytes.toString('utf8');
  const catalogMatch = catalogSource?.match(/export const libraries = (\{[\s\S]*\});?\s*$/);
  if (!catalogMatch) throw new Error('适用目录源码格式无效');
  const catalog = Object.entries(JSON.parse(catalogMatch[1])).map(([id, definition]) => ({ id, ...definition }));
  const generated = {
    'catalog.json': catalog,
    'package.json': { name: 'design-pal-codex', version, private: true, type: 'module', license: 'MIT', engines: { node: '>=24' }, scripts: { preview: 'node scripts/release.mjs preview .', verify: 'node scripts/release.mjs verify .' } },
    [markerName]: { project: 'design-pal-codex', format: 1, files: entries.filter(entry => entry.path.startsWith('src/')).map(entry => entry.path).sort() },
  };
  for (const [name, content] of Object.entries(generated)) entries.push({ path: name, bytes: Buffer.from(JSON.stringify(content, null, 2) + '\n') });
  entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  // 清单顺序与运行服务器允许列表保持一致。
  entries.find(entry => entry.path === markerName).bytes = Buffer.from(JSON.stringify({ ...generated[markerName], files: entries.filter(entry => entry.path.startsWith('src/')).map(entry => entry.path) }, null, 2) + '\n');
  const manifest = { project: 'design-pal-codex', format: 1, version, libraries: catalog, files: entries.map(entry => ({ path: entry.path, sha256: hash(entry.bytes) })) };
  const staging = await mkdtemp(path.join(path.dirname(output), '.design-pal-codex-release-'));
  try {
    for (const entry of entries) {
      await mkdir(path.dirname(path.join(staging, entry.path)), { recursive: true });
      await writeFile(path.join(staging, entry.path), entry.bytes, { flag: 'wx' });
    }
    await writeFile(path.join(staging, releaseManifestName), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    await verifyRelease(staging);
    // 原子占位拒绝并发生成同版本；目录存在即拒绝，不替换他人的内容。
    await mkdir(output);
    try {
      for (const name of await readdir(staging)) await rename(path.join(staging, name), path.join(output, name));
    } catch (error) {
      // 不完整版本保留，校验会拒绝使用；不删除可能已被外部改动的目录。
      throw new Error(`发行写入中断，保留目录供检查：${error.message}`);
    }
  } finally { await rm(staging, { recursive: true, force: true }); }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, value, extra] = process.argv.slice(2);
  if (command === 'create' && value && !extra) {
    const manifest = await createRelease({ version: value });
    console.log(`已生成本地候选发行 ${manifest.version}，${manifest.files.length} 个文件；尚不代表用户验收通过。`);
  } else if (command === 'verify' && value && !extra) {
    const manifest = await verifyRelease(path.resolve(value));
    console.log(`完整性检查通过：${manifest.version}，${manifest.files.length} 个文件。`);
  } else if (command === 'preview' && value && !extra) {
    await verifyRelease(path.resolve(value));
    const server = await startPreview({ root: path.resolve(value), port: 4174 });
    console.log(`固定发行预览：http://127.0.0.1:${server.address().port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  } else throw new Error('用法：node scripts/release.mjs create <version> | verify <目录> | preview <目录>');
}
