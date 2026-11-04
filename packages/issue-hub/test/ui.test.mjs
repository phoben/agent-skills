import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Script, createContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

async function page() {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', disabled: false, hidden: false, replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ''; } });
    return nodes.get(selector);
  };
  const calls = []; let app;
  class TestApp {
    constructor() { app = this; }
    async connect() {}
    getHostContext() { return {}; }
    callServerTool(args) { return new Promise(resolve => calls.push({ args, resolve })); }
  }
  const output = await build({ entryPoints: [fileURLToPath(new URL('../ui/proof.mjs', import.meta.url))], bundle: true, format: 'iife', platform: 'browser', write: false, loader: { '.css': 'empty' }, plugins: [{ name: '宿主测试边界', setup(build) { build.onResolve({ filter: /^@modelcontextprotocol\/ext-apps$/ }, () => ({ path: 'app', namespace: 'test' })); build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const App = globalThis.TestApp;' })); } }] });
  const document = { querySelector: node, querySelectorAll: () => ['#refresh', '#prepare', '#open', '#check'].map(node), createElement: () => ({ value: '', textContent: '' }), documentElement: { style: {} } };
  const context = createContext({ TestApp, document, crypto: { randomUUID } });
  new Script(output.outputFiles[0].text).runInContext(context);
  await new Promise(resolve => setImmediate(resolve));
  return { node, app, calls };
}
const view = key => ({ schemaVersion: 1, catalog: { status: 'complete', projects: 2 }, repository: key ? { key, fullName: `fixture/${key}`, workspaces: [{ key: 'workspace', cwd: 'C:/workspace' }] } : null });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('迟到的初始状态不能清除已收到的仓库诊断上下文', async () => {
  const p = await page();
  assert.equal(p.calls[0].args.name, 'issue-proof-status');
  p.app.ontoolresult({ structuredContent: view('a') });
  p.calls[0].resolve({ structuredContent: view(null) }); await tick();
  assert.equal(p.node('#repository-name').textContent, 'fixture/a'); assert.equal(p.node('#repository').hidden, false);
});

test('准备期间切换诊断仓库时不把旧请求显示为新仓库任务', async () => {
  const p = await page(); p.app.ontoolresult({ structuredContent: view('a') }); p.calls[0].resolve({ structuredContent: view(null) }); await tick();
  const pending = p.node('#prepare').onclick();
  p.app.ontoolresult({ structuredContent: view('b') });
  p.calls.find(call => call.args.name === 'issue-proof-task-prepare').resolve({ structuredContent: { requestId: randomUUID(), prompt: '旧请求', status: 'prepared' } }); await pending;
  assert.equal(p.node('#repository-name').textContent, 'fixture/b'); assert.equal(p.node('#prompt').value, ''); assert.equal(p.node('#open').disabled, true);
});

test('返回重建的页面后恢复请求并可继续检查关联', async () => {
  const p = await page(); p.app.ontoolresult({ structuredContent: view('a') }); p.calls[0].resolve({ structuredContent: view(null) }); await tick();
  const requestId = randomUUID();
  const latest = p.calls.find(call => call.args.name === 'issue-proof-task-latest');
  assert.equal(latest.args.arguments.repositoryKey, 'a'); assert.equal(latest.args.arguments.workspaceKey, 'workspace');
  latest.resolve({ structuredContent: { request: { requestId, prompt: '已发送的验证引用', status: 'requested' } } }); await tick();
  assert.equal(p.node('#prompt').value, '已发送的验证引用'); assert.equal(p.node('#check').disabled, false);
  const checking = p.node('#check').onclick();
  const call = p.calls.find(call => call.args.name === 'issue-proof-task-check'); assert.equal(call.args.arguments.requestId, requestId);
  call.resolve({ structuredContent: { requestId, prompt: '已发送的验证引用', status: 'linked', threadId: 'known-thread' } }); await checking;
  assert.match(p.node('#request-state').textContent, /known-thread/);
});

test('迟到的恢复结果不能覆盖用户刚准备的新请求', async () => {
  const p = await page(); p.app.ontoolresult({ structuredContent: view('a') }); p.calls[0].resolve({ structuredContent: view(null) }); await tick();
  const restoring = p.calls.find(call => call.args.name === 'issue-proof-task-latest');
  const preparing = p.node('#prepare').onclick();
  p.calls.find(call => call.args.name === 'issue-proof-task-prepare').resolve({ structuredContent: { requestId: randomUUID(), prompt: '新请求', status: 'prepared' } }); await preparing;
  restoring.resolve({ structuredContent: { request: { requestId: randomUUID(), prompt: '旧请求', status: 'requested' } } }); await tick();
  assert.equal(p.node('#prompt').value, '新请求'); assert.equal(p.node('#check').disabled, true);
});

test('宿主关闭后忽略迟到恢复结果并禁用验证动作', async () => {
  const p = await page(); p.app.ontoolresult({ structuredContent: view('a') }); p.calls[0].resolve({ structuredContent: view(null) }); await tick();
  const restoring = p.calls.find(call => call.args.name === 'issue-proof-task-latest');
  p.app.onclose();
  restoring.resolve({ structuredContent: { request: { requestId: randomUUID(), prompt: '旧请求', status: 'requested' } } }); await tick();
  const count = p.calls.length; await p.node('#prepare').onclick();
  assert.equal(p.calls.length, count); assert.equal(p.node('#open').disabled, true); assert.equal(p.node('#prepare').disabled, true);
  assert.match(p.node('#message').textContent, /已关闭/); assert.equal(p.node('#prompt').value, '');
});
