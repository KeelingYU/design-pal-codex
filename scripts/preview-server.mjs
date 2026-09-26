import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBuildManifest } from './build.mjs';

const defaultRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function safeRequestPath(url) {
  let requested;
  try { requested = decodeURIComponent(url.split('?')[0]); }
  catch { return null; }
  if (!requested.startsWith('/') || /[\\\x00-\x1f\x7f]/.test(requested)) return null;
  if (requested === '/') return '';
  const parts = requested.slice(1).split('/');
  if (parts[0] !== 'src' || parts.some(part => !part || part.startsWith('.')
      || /(?:credential|\.(?:key|pem)$|^__MACOSX$|^CLAUDE\.local\.md$)/i.test(part))) return null;
  return parts.join('/');
}

export async function startPreview({ root = defaultRoot, port = 4173 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('端口必须是 0 至 65535 的整数');
  const manifest = await readBuildManifest(root);
  root = await realpath(root);
  const files = new Set(manifest.files);
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const relative = safeRequestPath(request.url);
    if (relative === '') {
      response.writeHead(302, { Location: '/src/preview/index.html' }).end();
      return;
    }
    if (relative === null || !files.has(relative)) {
      response.writeHead(404).end('未找到资源');
      return;
    }
    try {
      const rootInfo = await lstat(root);
      if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
        response.writeHead(404).end('未找到资源');
        return;
      }
      let current = root;
      const parts = relative.split('/');
      for (const [index, part] of parts.entries()) {
        current = path.join(current, part);
        const info = await lstat(current);
        if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) {
          response.writeHead(404).end('未找到资源');
          return;
        }
      }
      const bytes = await readFile(current);
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(current).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': bytes.length,
      }).end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(404).end('未找到资源');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  const seen = new Set();
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!['--port', '--root'].includes(key) || seen.has(key) || !value || (key === '--port' && !/^\d+$/.test(value))) {
      throw new Error('用法：npm run preview -- [--port 4173] [--root dist]');
    }
    seen.add(key);
    options[key.slice(2)] = key === '--port' ? Number(value) : path.resolve(value);
  }
  const server = await startPreview(options);
  console.log(`本地预览：http://127.0.0.1:${server.address().port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
