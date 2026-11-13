import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2], 'packages/issue-hub');
const preview = resolve(root, 'scripts/preview.mjs');
const require = createRequire(preview);
let code = await readFile(preview, 'utf8');
function substitute(from, to) {
  if (!code.includes(from)) throw new Error('预览验证入口已变化');
  code = code.replace(from, to);
}
substitute("const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');", `const root = ${JSON.stringify(root)};`);
substitute('const tasks = createIssueTasks({ catalog, bridge, storage, issues });', `
// 浏览器验证仅替换任务操作。真实 Issue 数据由只读预览读取。
const fixture = { checks: 0, opened: 0, returned: 0, sent: false, sameRequest: false };
let taskRecord = null;
let releaseReturn;
const tasks = { async execute(action, payload) {
  if (action === 'open') {
    if (payload.reuseOnly && taskRecord?.status === 'linked') {
      fixture.returned++;
      fixture.sameRequest = payload.requestId === taskRecord.requestId;
      if (!fixture.sameRequest) throw new Error('返回未复用当前请求');
      await new Promise(resolve => { releaseReturn = resolve; });
    } else {
      fixture.opened++;
      taskRecord = { requestId: payload.requestId, id: payload.requestId, status: 'requested', title: '测试会话', number: payload.number, repositoryKey: payload.repositoryKey, path: 'E:/Fixture', prompt: '测试草稿', reference: '任务引用：issue-hub:fixture' };
    }
  } else if (action === 'check') {
    fixture.checks++;
    if (payload.requestId !== taskRecord?.requestId) throw new Error('检查未使用当前请求');
    taskRecord = { ...taskRecord, status: fixture.sent ? 'linked' : 'pending', ...(fixture.sent ? { threadId: '33333333-3333-4333-8333-333333333333' } : {}) };
  } else if (action !== 'latest') throw new Error('非预期验证动作');
  return { schemaVersion: 1, identity: Number(payload.expectedIdentity), data: { current: taskRecord, history: [], binding: null, workspaces: [{ key: 'a'.repeat(20), cwd: 'E:/Fixture', projectName: '测试工作区' }] } };
} };`);
substitute("['latest', 'bind'].includes(input.arguments?.action)", "['latest', 'open', 'check'].includes(input.arguments?.action)");
substitute("  if (request.method === 'GET' && (request.url === '/app'", `  if (request.url === '/fixture-task' && request.method === 'POST') {
    fixture.sent = true;
    response.writeHead(204).end();
    return;
  }
  if (request.url === '/fixture-return' && request.method === 'POST') {
    releaseReturn?.();
    response.writeHead(204).end();
    return;
  }
  if (request.url === '/fixture-task' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(fixture));
    return;
  }
  if (request.method === 'GET' && (request.url === '/app'`);
const importEnd = code.indexOf('// 只读浏览器联调');
code = code.slice(0, importEnd).replace(/^import .+? from '([^']+)';$/gm, (line, specifier) => {
  if (specifier.startsWith('node:')) return line;
  const path = specifier.startsWith('.') ? resolve(dirname(preview), specifier) : require.resolve(specifier);
  return line.replace(`'${specifier}'`, JSON.stringify(pathToFileURL(path).href));
}) + code.slice(importEnd);
// require.resolve 定位 SDK 的 CJS 入口时，由 Node 的命名导出兼容层加载。
await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
