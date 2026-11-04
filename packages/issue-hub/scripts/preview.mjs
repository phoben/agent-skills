import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHostBridge } from '../src/host/bridge.mjs';
import { createCatalog } from '../src/catalog.mjs';
import { createStorage } from '../src/storage/database.mjs';
import { createGithubClient } from '../src/github/client.mjs';
import { createIssueService } from '../src/services/issues.mjs';
import { createIssueTasks } from '../src/services/issue-tasks.mjs';
import { createIssueServer } from '../src/server.mjs';
import { createIssueHubIcons } from '../src/icons.mjs';
import { createRuntimeDiagnostics } from '../src/diagnostics.mjs';

// 只读浏览器联调使用同一正式MCP路由；不开放GitHub写入或聊天动作。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.ISSUE_HUB_PREVIEW_PORT || 18287);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('预览端口无效');
const host = `127.0.0.1:${port}`, token = randomBytes(24).toString('base64url');
const html = await readFile(resolve(root, '../../plugins/issue-hub/dist/app.html'), 'utf8');
const icons = createIssueHubIcons(await readFile(resolve(root, '../../plugins/issue-hub/assets/icon.svg'), 'utf8'));
const bridge = createHostBridge();
const catalog = createCatalog({ bridge });
const storage = createStorage({ directory: await mkdtemp(join(tmpdir(), 'issue-hub-preview-')) });
const github = createGithubClient();
const issues = createIssueService({ github, storage, catalog });
const diagnostics = createRuntimeDiagnostics({bridge,github,catalog,directory:dirname(storage.filename)});
const tasks = createIssueTasks({ catalog, bridge, storage, issues });
const mcp = createIssueServer({ html, issues, tasks, diagnostics, icons });
const client = new Client({ name: 'issue-hub-readonly-preview', version: '1.0.0' });
const [left, right] = InMemoryTransport.createLinkedPair(); await mcp.connect(left); await client.connect(right);
const browser = await build({ absWorkingDir: root, stdin: { contents: `
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame = document.querySelector('iframe');
const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
const bridge = new AppBridge(null, {name:'Issue Hub Readonly Preview',version:'1'}, {serverTools:{},openLinks:{}}, {hostContext:{theme,displayMode:'inline',availableDisplayModes:['inline']}});
// 仅联调宿主提供的亮暗通知和颜色变量，不进入正式页面产物。
window.__issueHubPreviewTheme = context => bridge.setHostContext({theme,displayMode:'inline',availableDisplayModes:['inline'],...context});
bridge.oncalltool = async params => {
  const response = await fetch('/tool', {method:'POST',headers:{'content-type':'application/json','x-issue-preview-token':${JSON.stringify(token)}},body:JSON.stringify(params)});
  return response.json();
};
bridge.onopenlink = async () => ({isError:true});
bridge.oninitialized = async () => { await bridge.sendToolInput({arguments:{}}); };
await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));
frame.src = '/app';
// 仅为截图定位真实读取对象，不改变正式页面的启动契约。
const params = new URLSearchParams(location.search);
const selectedRepo = params.get('repo'), selectedIssue = params.get('issue');
frame.addEventListener('load', () => {
  const doc = frame.contentDocument;
  let repositorySelected = false, issueSelected = false;
  const observer = new MutationObserver(() => {
    if (!repositorySelected && selectedRepo) {
      const node = [...doc.querySelectorAll('[data-action="repository"]')].find(item => item.getAttribute('data-repo') === selectedRepo);
      if (node) { repositorySelected = true; node.click(); return; }
    }
    if ((!selectedRepo || repositorySelected) && !issueSelected && selectedIssue && (!selectedRepo || doc.querySelector('#queue-title')?.textContent === selectedRepo)) {
      const node = [...doc.querySelectorAll('[data-action="open-issue"]')].find(item => item.getAttribute('data-number') === selectedIssue);
      if (node) { issueSelected = true; node.click(); observer.disconnect(); }
    }
  });
  observer.observe(doc.body,{subtree:true,childList:true});
});
`, resolveDir: root, sourcefile: 'readonly-preview-host.mjs' }, bundle: true, write: false, format: 'esm', target: 'chrome120' });
const shell = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Issue Hub 只读联调</title><style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%}</style><iframe title="Issue Hub"></iframe><script type="module">${browser.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></html>`;
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Cache-Control', 'no-store');
  if (request.headers.host !== host || request.headers.origin && request.headers.origin !== `http://${host}`) { response.writeHead(403).end(); return; }
  if (request.method === 'GET' && (request.url === '/app' || request.url === '/' || request.url?.startsWith('/?'))) {
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; img-src data:; frame-ancestors 'self'");
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(request.url === '/app' ? html : shell); return;
  }
  if (request.method !== 'POST' || request.url !== '/tool' || request.headers['x-issue-preview-token'] !== token) { response.writeHead(404).end(); return; }
  try {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 65536) throw new Error('请求过大'); chunks.push(chunk); }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    // 仅允许读任务或保存本机工作区偏好，打开/检查/确认会话仍不放行。
    const isTaskRead = input.name === 'issue-hub-task' && ['latest', 'bind'].includes(input.arguments?.action);
    const isLocalDraft = input.name === 'issue-hub-mutate' && ['draft-save', 'preference-save', 'view-state-save'].includes(input.arguments?.action);
    if (!isTaskRead && !isLocalDraft && !['issue-hub-open', 'issue-hub-query', 'issue-hub-diagnostics', 'issue-read', 'issue-comments', 'issue-repositories'].includes(input.name)) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ isError: true, structuredContent: { error: { code: 'READONLY_PREVIEW', message: '此浏览器联调入口只读，写入及会话请在 Codex 插件内操作。' } }, content: [] })); return;
    }
    const result = await client.callTool(input, undefined, { timeout: 120000 });
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(result));
  } catch { response.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ isError: true, structuredContent: { error: { code: 'PREVIEW_FAILED', message: '只读预览请求失败。' } }, content: [] })); }
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`真实MCP只读预览：http://${host}/\n`));
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { if (closing) return; closing = true; server.close(); await client.close(); await mcp.close(); storage.close(); await bridge.close(); });
