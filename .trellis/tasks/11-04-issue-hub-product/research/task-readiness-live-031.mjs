import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { LiveStore } from '../../../../packages/issue-hub/ui/store.mjs';

// 仅查真实目录、Issue和latest；--bind仅写自有临时库绑定，不打开聊天或写GitHub。
const bindOnly = process.argv.includes('--bind');
const directory = await mkdtemp(join(tmpdir(), 'issue-hub-task-readiness-'));
const report = { readOnly: !bindOnly, localBindingOnly: bindOnly, chatOpened: false, remoteWrites: false, phases: [], failure: null };
let client;
async function start() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('plugins/issue-hub/dist/issue-hub.cjs')], cwd: tmpdir(), stderr: 'pipe', env: { ...process.env, ISSUE_HUB_DATA_DIR: directory } });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'issue-hub-task-readiness-check', version: '1' });
  await client.connect(transport, { timeout: 120000 });
  const store = new LiveStore(async (group, action, payload) => {
    if (group === 'mutate' || group === 'task' && action !== 'latest' && !(bindOnly && action === 'bind')) throw new Error('拒绝远端写入或打开聊天');
    const result = await client.callTool({ name: group === 'task' ? 'issue-hub-task' : 'issue-hub-query', arguments: { action, payload } }, undefined, { timeout: 120000 });
    if (result.isError) throw Object.assign(new Error(result.structuredContent.error.message), result.structuredContent.error);
    return result.structuredContent;
  });
  return store;
}
async function capture(name, store) {
  const started = Date.now();
  const entry = { name, version: client.getServerVersion()?.version, catalog: { status: store.catalog.status, checking: Boolean(store.catalog.checking) }, onlineBefore: store.online };
  try {
    await store.loadRepository('phoben/agent-skills');
    await store.loadIssue('phoben/agent-skills', 5, { summary: true });
    const record = await store.loadTask('phoben/agent-skills', 5);
    entry.latestPassed = true; entry.workspaceCount = record.workspaces.length; entry.hasCurrent = Boolean(record.current);
    if (bindOnly) {
      if (record.workspaces.length !== 1) throw new Error('本测试要求项目恰好一个工作区');
      await store.bind('phoben/agent-skills', record.workspaces[0].key);
      entry.bindPassed = true;
    }
  } catch (error) { entry.error = { code: error.code || 'HARNESS_ERROR', message: error.message }; }
  entry.onlineAfter = store.online;
  entry.catalogAfter = { status: store.catalog.status, checking: Boolean(store.catalog.checking) };
  entry.elapsedMs = Date.now() - started;
  report.phases.push(entry); console.log(JSON.stringify(entry));
}
try {
  let store = await start(); await store.load(); await store.refreshCatalog(); await capture('fresh-full-refresh', store); await client.close();
  store = await start(); await store.load(); await capture('reopened-cached-bootstrap', store);
} catch (error) { report.failure = { code: error.code || 'HARNESS_ERROR', message: error.message }; }
finally {
  await client?.close();
  if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}issue-hub-task-readiness-`)) throw new Error('拒绝清理非自有目录');
  await rm(directory, { recursive: true, force: true }); report.temporaryStorageRemoved = true;
  const variant = `${process.argv.includes('--fixed') ? 'after' : 'before'}${bindOnly ? '-bind' : ''}${process.argv.includes('--final') ? '-final' : ''}`;
  if (process.argv.includes('--fixed') && (report.failure || report.phases.length !== 2 || report.phases.some(phase => phase.error || bindOnly && !phase.bindPassed))) { process.exitCode = 1; report.passed = false; }
  else if (process.argv.includes('--fixed')) report.passed = true;
  await writeFile(new URL(`./task-readiness-live-031-${variant}.json`, import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
