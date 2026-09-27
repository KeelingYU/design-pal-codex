import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
// 此服务只提供独立样例和组件；不提供仓库、过程文档或任意文件。
export async function startExample(root) {
  root = await realpath(root);
  let sourceFiles;
  for (const file of ['.design-pal-codex-build.json', 'publishing/public-files.json', 'release-files.json']) {
    try {
      const manifest = JSON.parse(await readFile(path.join(root, file), 'utf8'));
      if (manifest.project !== 'design-pal-codex' || !Array.isArray(manifest.files)) throw new Error('资源清单无效');
      sourceFiles = manifest.files.map(entry => typeof entry === 'string' ? entry : entry.target).filter(file => typeof file === 'string' && file.startsWith('src/'));
      break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!sourceFiles?.length) throw new Error('缺少组件资源清单');
  const allowed = new Set([...sourceFiles, ...['index.html', 'baseline.html', 'page.css', 'page.mjs', 'baseline.mjs', 'model.mjs'].map(file => `examples/acceptance/${file}`)]);
  const server = createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const raw = decodeURIComponent(req.url.split('?')[0]);
      const parts = raw.slice(1).split('/');
      if (!raw.startsWith('/') || raw.includes('\\') || parts.some(part => !part || part.startsWith('.')) ||
        !allowed.has(parts.join('/'))) throw new Error('不允许的资源');
      let current = root;
      for (const part of parts) { current = path.join(current, part); if ((await lstat(current)).isSymbolicLink()) throw new Error('不允许符号链接'); }
      const bytes = await readFile(current);
      const types = { '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' };
      res.writeHead(200, { 'Content-Type': `${types[path.extname(current)] || 'application/octet-stream'}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404).end('未找到资源'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === (await import('node:url')).fileURLToPath(import.meta.url)) {
  const root = (await import('node:url')).fileURLToPath(new URL('../../', import.meta.url));
  const server = await startExample(root);
  console.log(`模拟业务样例：${server.url}/examples/acceptance/index.html`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); });
}
