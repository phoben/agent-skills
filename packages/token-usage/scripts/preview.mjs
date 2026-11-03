import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUsageService } from '../src/service.mjs';
import { safeFailure } from '../src/contracts.mjs';

const port = Number(process.env.YG_TOKEN_PREVIEW_PORT || 48765);
const token = randomBytes(24).toString('base64url');
const host = `127.0.0.1:${port}`;
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const html = (await readFile(resolve(repo, 'plugins/yg-toolkit/dist/token-usage.html'), 'utf8')).replace('<script>', `<script>window.__TOKEN_PREVIEW_TOKEN__=${JSON.stringify(token)};</script><script>`);
const service = createUsageService();
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (request.headers.host !== host || request.headers.origin && request.headers.origin !== `http://${host}`) { response.writeHead(403).end(); return; }
  if (request.method === 'GET' && request.url === '/') {
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; frame-ancestors 'none'");
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html); return;
  }
  if (request.method !== 'POST' || !['/api/dashboard', '/api/sessions'].includes(request.url) || request.headers['x-yg-preview-token'] !== token) { response.writeHead(404).end(); return; }
  try {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 262144) throw new Error('请求过大'); chunks.push(chunk); }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result = await service[request.url.endsWith('dashboard') ? 'dashboard' : 'sessions'](input);
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(result));
  } catch (error) { response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: safeFailure(error) })); }
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`真实数据预览：http://${host}/\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { server.close(); await service.close(); });
