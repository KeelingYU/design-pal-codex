import { lstat, readdir, readFile, mkdir, mkdtemp, writeFile, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const markerName = '.design-pal-codex-build.json';
export const requiredFiles = [
  'index.mjs',
  'components/styles.css',
  'components/dom.mjs',
  'components/forms.mjs',
  'components/forms.css',
  'components/table.mjs',
  'components/table.css',
  'components/navigation.mjs',
  'components/navigation.css',
  'components/feedback.mjs',
  'components/feedback.css',
  'libraries/catalog.mjs',
  'libraries/component-list.mjs',
  'preview/index.html',
  'preview/foundation.mjs',
  'preview/foundation.css',
  'preview/components.html',
  'preview/components.mjs',
  'preview/components.css',
  'assets/LICENSE-phosphor.txt',
];

async function scan(root, relative = '', directories = []) {
  const current = path.join(root, relative);
  const info = await lstat(current);
  if (info.isSymbolicLink()) throw new Error('构建目录不得包含符号链接');
  if (info.isFile()) return [relative];
  if (!info.isDirectory()) throw new Error('构建目录不得包含特殊文件');
  directories.push(relative);
  const files = [];
  for (const name of (await readdir(current)).sort()) {
    files.push(...await scan(root, path.posix.join(relative, name), directories));
  }
  return files;
}

export async function readBuildManifest(root) {
  const info = await lstat(root);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('构建输出必须是受管目录，不能是符号链接');
  const marker = path.join(root, markerName);
  const markerInfo = await lstat(marker).catch(() => null);
  if (!markerInfo?.isFile() || markerInfo.isSymbolicLink()) throw new Error('拒绝使用非受管目录');
  let manifest;
  try { manifest = JSON.parse(await readFile(marker, 'utf8')); }
  catch { throw new Error('受管目录标记无效'); }
  if (manifest.project !== 'design-pal-codex' || manifest.format !== 1
      || !Array.isArray(manifest.files)
      || !manifest.files.every(file => typeof file === 'string' && file.startsWith('src/')
        && !file.includes('\\') && !file.split('/').some(part => !part || part === '.' || part === '..'))
      || new Set(manifest.files).size !== manifest.files.length
      || !requiredFiles.every(file => manifest.files.includes(`src/${file}`))) {
    throw new Error('受管目录标记无效');
  }
  return manifest;
}

function overlaps(left, right) {
  return left === right || left.startsWith(right + path.sep) || right.startsWith(left + path.sep);
}

// 先准备全部资源，再替换已有受管输出；源文件检查失败时不影响旧预览。
export async function build({ source = path.join(projectRoot, 'src'), output = path.join(projectRoot, 'dist') } = {}) {
  source = path.resolve(source);
  output = path.resolve(output);
  if ((await lstat(source)).isSymbolicLink()) throw new Error('源码不得使用符号链接');
  source = await realpath(source);
  output = path.join(await realpath(path.dirname(output)), path.basename(output));
  if (overlaps(source, output)) throw new Error('源码与构建输出不得重叠');
  const files = await scan(source);
  for (const file of requiredFiles) {
    if (!files.includes(file)) throw new Error(`缺少必需资源：${file}`);
  }
  const entries = await Promise.all(files.map(async file => ({ file: `src/${file}`, bytes: await readFile(path.join(source, file)) })));
  const previous = await lstat(output).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (previous) {
    const manifest = await readBuildManifest(output);
    const known = new Set([markerName, ...manifest.files]);
    const knownDirectories = new Set(['']);
    for (const file of manifest.files) {
      let parent = path.posix.dirname(file);
      while (parent !== '.') {
        knownDirectories.add(parent);
        parent = path.posix.dirname(parent);
      }
    }
    const directories = [];
    if ((await scan(output, '', directories)).some(file => !known.has(file))
        || directories.some(directory => !knownDirectories.has(directory))) {
      throw new Error('受管目录中存在额外文件或目录，拒绝覆盖');
    }
  }
  const temporary = await mkdtemp(path.join(path.dirname(output), '.design-pal-codex-build-'));
  const staged = path.join(temporary, 'next');
  const backup = path.join(temporary, 'previous');
  let movedPrevious = false;
  try {
    await mkdir(staged);
    for (const { file, bytes } of entries) {
      await mkdir(path.dirname(path.join(staged, file)), { recursive: true });
      await writeFile(path.join(staged, file), bytes, { flag: 'wx' });
    }
    await writeFile(path.join(staged, markerName), JSON.stringify({ project: 'design-pal-codex', format: 1, files: entries.map(entry => entry.file) }, null, 2) + '\n');
    if (previous) {
      await rename(output, backup);
      movedPrevious = true;
    }
    try { await rename(staged, output); }
    catch (error) {
      if (movedPrevious) {
        await rename(backup, output);
        movedPrevious = false;
      }
      throw error;
    }
  } finally {
    // 替换失败且旧输出无法恢复时，保留备份供人工恢复。
    const outputExists = await lstat(output).catch(() => null);
    if (!movedPrevious || outputExists) await rm(temporary, { recursive: true, force: true });
  }
  return { files: entries.map(entry => entry.file) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('用法：npm run build');
  const result = await build();
  console.log(`构建完成：${result.files.length} 个源码资源已复制到 dist/src/。`);
}
