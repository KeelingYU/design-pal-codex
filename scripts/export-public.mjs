import { lstat, readFile, realpath, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const privatePart = /^(?:\.git|\.env(?:\..*)?|.*credential.*|.*\.(?:key|pem)|\.DS_Store|__MACOSX|CLAUDE\.local\.md|PRD\.md|方案\.md|交接\.md|决策记录\.md)$/i;
const sensitiveText = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/,
  /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[^\s"'<>]+/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:api[_-]?key|access[_-]?token|password)\s*[=:]\s*["'][^"'\s]{8,}["']/i,
];

function validatePath(value) {
  if (typeof value !== 'string' || !value || /[\\:*?\x00-\x1f]/.test(value)
      || value.split('/').some(part => !part || part === '.' || part === '..' || privatePart.test(part))) {
    throw new Error('白名单包含禁止公开或不规范的路径');
  }
  if (/[^\x00-\x7F]/.test(value)) throw new Error('公开文件必须使用英文路径');
}

async function sourceFile(root, relative) {
  let current = root;
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) {
      throw new Error('公开文件不得是符号链接、目录或特殊文件');
    }
  }
  return current;
}

// 只导出文件；不创建 Git 历史，不设置远端，也不执行网络发布。
export async function exportPublic({ root, output, manifest }) {
  root = await realpath(root);
  output = path.join(await realpath(path.dirname(path.resolve(output))), path.basename(output));
  if (output === root || output.startsWith(root + path.sep)) throw new Error('公开导出必须位于开发仓库外');
  try {
    await lstat(output);
    throw new Error('公开导出目录必须尚不存在');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (manifest.project !== 'design-pal-codex' || manifest.license !== 'MIT' || !manifest.files?.length) {
    throw new Error('公开项目名称、许可证或文件清单无效');
  }
  const targets = new Set();
  const prepared = [];
  for (const entry of manifest.files) {
    validatePath(entry.source);
    validatePath(entry.target);
    if (['AGENTS.md', 'CLAUDE.md', 'docs/demo/README.md'].includes(entry.source)
        || (entry.source.startsWith('docs/') && !entry.source.startsWith('docs/demo/'))) {
      throw new Error('开发过程文档禁止公开');
    }
    const targetKey = entry.target.toLowerCase();
    if (targets.has(targetKey)) throw new Error('公开目标路径重复');
    targets.add(targetKey);
    const bytes = await readFile(await sourceFile(root, entry.source));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (entry.binarySha256) {
      if (!/\.(?:jpg|png)$/.test(entry.target) || entry.binarySha256 !== sha256) {
        throw new Error('二进制文件必须与人工审核过的图片一致');
      }
    } else {
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('未审核的二进制内容禁止公开'); }
      if (text.includes('\0') || sensitiveText.some(pattern => pattern.test(text))) {
        throw new Error('公开文件含疑似隐私或凭据，请人工检查；不会显示命中内容');
      }
    }
    prepared.push({ target: entry.target, bytes, sha256 });
  }
  await mkdir(output);
  try {
    for (const entry of prepared) {
      const destination = path.join(output, entry.target);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, entry.bytes, { flag: 'wx' });
    }
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
  return prepared.map(({ target, sha256 }) => ({ target, sha256 }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv.length !== 3) throw new Error('用法：node scripts/export-public.mjs <仓库外的全新目录>');
  const manifest = JSON.parse(await readFile(path.join(root, 'publishing/public-files.json'), 'utf8'));
  const result = await exportPublic({ root, output: process.argv[2], manifest });
  console.log(JSON.stringify({ files: result }, null, 2));
}
