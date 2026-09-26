import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { build, requiredFiles } from '../../scripts/build.mjs';
import { startPreview } from '../../scripts/preview-server.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'design-pal-codex-server-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'src');
  const output = path.join(root, 'dist');
  for (const file of [...requiredFiles, '.env', 'private.key', 'credential.txt']) {
    await mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await writeFile(path.join(source, file), `测试资源：${file}`);
  }
  await writeFile(path.join(root, 'secret.txt'), '私密内容');
  await build({ source, output });
  return { root, source, output };
}

async function serve(t, output) {
  const server = await startPreview({ root: output, port: 0 });
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal(server.address().address, '127.0.0.1');
  return server.address().port;
}

function get(port, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: requestPath, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('仅监听本机，首页跳转，源码和许可可访问，响应类型正确', async t => {
  const f = await fixture(t);
  const port = await serve(t, f.output);
  const redirect = await get(port, '/');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.location, '/src/preview/index.html');
  const module = await get(port, '/src/index.mjs?version=1');
  assert.equal(module.status, 200);
  assert.equal(module.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(module.body, '测试资源：index.mjs');
  assert.equal((await get(port, '/src/assets/LICENSE-phosphor.txt')).status, 200);
  const head = await get(port, '/src/preview/index.html', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal((await get(port, '/src/index.mjs', 'POST')).status, 405);
});

test('拒绝开发资料、点文件、凭据、目录列表和各种路径逃逸', async t => {
  const f = await fixture(t);
  const port = await serve(t, f.output);
  for (const url of [
    '/AGENTS.md', '/docs/PRD.md', '/secret.txt', '/src/', '/src/missing.mjs',
    '/.design-pal-codex-build.json', '/src/.env', '/src/private.key', '/src/credential.txt',
    '/src/../secret.txt', '/src/%2e%2e/secret.txt', '/src/%2e%2e%2fsecret.txt',
    '/src/%2e%2e%5csecret.txt', '/src/%252e%252e/secret.txt', '//src/index.mjs',
    '/src/%00index.mjs', '/src/%zz', '/src/preview/../../secret.txt',
  ]) {
    const response = await get(port, url);
    assert.equal(response.status, 404, url);
    assert.ok(!response.body.includes('私密内容'), url);
  }
  await writeFile(path.join(f.output, 'src/new-file.txt'), '未经构建的新内容');
  assert.equal((await get(port, '/src/new-file.txt')).status, 404);
});

test('启动拒绝开发目录和符号链接根目录，运行时拒绝文件及子目录符号链接', async t => {
  const f = await fixture(t);
  await assert.rejects(startPreview({ root: f.root, port: 0 }), /受管/);
  const linkedRoot = path.join(f.root, 'linked');
  await symlink(f.output, linkedRoot);
  await assert.rejects(startPreview({ root: linkedRoot, port: 0 }), /符号链接/);
  const port = await serve(t, f.output);
  await rm(path.join(f.output, 'src/index.mjs'));
  await symlink(path.join(f.root, 'secret.txt'), path.join(f.output, 'src/index.mjs'));
  assert.equal((await get(port, '/src/index.mjs')).status, 404);
  await rm(path.join(f.output, 'src/preview'), { recursive: true });
  await symlink(path.join(f.source, 'preview'), path.join(f.output, 'src/preview'));
  assert.equal((await get(port, '/src/preview/index.html')).status, 404);
  await rm(f.output, { recursive: true });
  await symlink(f.root, f.output);
  assert.equal((await get(port, '/src/preview/index.html')).status, 404);
});

test('命令行支持独立根目录和端口', async t => {
  const f = await fixture(t);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/preview-server.mjs', import.meta.url)), '--root', f.output, '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(output);
      if (match) resolve(Number(match[1]));
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`预览命令提前退出：${code}`)));
  });
  assert.equal((await get(port, '/src/preview/index.html')).status, 200);
});
