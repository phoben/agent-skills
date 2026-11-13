import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { LiveStore } from '../../../../packages/issue-hub/ui/store.mjs';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';

// 真实gh传输失败仅限测试子进程；不改系统代理或网络，不使用正式业务数据库。
const directory = await mkdtemp(join(tmpdir(), 'issue-hub-offline-acceptance-'));
const report = { systemNetworkChanged: false, actualUserDataModified: false, realGhTransport: true, controlledProxyFailure: true, desktopUiVerified: false, remoteWrites: false, chatOpened: false, stages: [], failure: null };
const repository = 'phoben/agent-skills', number = 5, github = createGithubClient();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['https_proxy', 'http_proxy', 'all_proxy', 'no_proxy'].includes(key.toLowerCase())));
let client, deniedConnections = 0;
const blocker = createServer(socket => { deniedConnections++; socket.destroy(); });
await new Promise((resolveListen, reject) => { blocker.once('error', reject); blocker.listen(0, '127.0.0.1', resolveListen); });
const proxy = `http://127.0.0.1:${blocker.address().port}`;
const localMutationCalls = [];
async function start(offline) {
  const env = { ...(offline ? baseEnv : process.env), ISSUE_HUB_DATA_DIR: directory, ...(offline ? { HTTPS_PROXY: proxy, HTTP_PROXY: proxy, ALL_PROXY: proxy, NO_PROXY: '' } : {}) };
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('plugins/issue-hub/dist/issue-hub.cjs')], cwd: tmpdir(), stderr: 'pipe', env });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'issue-hub-offline-transport-acceptance', version: '1' }); await client.connect(transport, { timeout: 120000 });
  report.version = client.getServerVersion()?.version;
  return new LiveStore(async (group, action, payload) => {
    const allowed = group === 'query' && ['bootstrap', 'refresh', 'list', 'read-summary'].includes(action) || group === 'mutate' && action === 'draft-save';
    assert.ok(allowed, '拒绝发布、任务操作及其他写入');
    if (group === 'mutate') localMutationCalls.push(action);
    const response = await client.callTool({ name: group === 'query' ? 'issue-hub-query' : 'issue-hub-mutate', arguments: { action, payload } }, undefined, { timeout: 120000 });
    if (response.isError) throw Object.assign(new Error(response.structuredContent.error.message), response.structuredContent.error);
    return response.structuredContent;
  });
}
async function close() { await client?.close(); client = null; }
try {
  report.phase = 'online-cache-seed';
  const remoteBefore = (await github.request('GET', `/repos/${repository}/issues/${number}`)).data;
  let store = await start(false); await store.load(); await store.refreshCatalog();
  await store.loadRepository(repository); await store.loadIssue(repository, number, { summary: true });
  assert.equal(store.online, true); const original = store.issue(repository, number), bodyHash = digest(original.body);
  report.stages.push({ name: 'online-cache-seeded', passed: true }); await close();

  report.phase = 'controlled-gh-disconnection';
  store = await start(true); await store.load(); await store.loadIssue(repository, number, { summary: true });
  assert.equal(store.online, false); assert.equal(digest(store.issue(repository, number).body), bodyHash); assert.ok(deniedConnections > 0);
  const issueDraft = { title: original.title, body: '离线传输验收的本机正文草稿，不发布。' }, commentDraft = { text: '离线传输验收的本机评论草稿，不发布。' };
  await store.saveDraft(repository, number, 'issue', issueDraft); await store.saveDraft(repository, number, 'comment', commentDraft);
  report.stages.push({ name: 'real-gh-blocked-cache-and-two-drafts', passed: true, online: store.online }); await close();

  report.phase = 'offline-restart';
  store = await start(true); await store.load(); await store.loadIssue(repository, number, { summary: true });
  assert.equal(store.online, false); assert.equal(store.draft(repository, number, 'issue').body, issueDraft.body); assert.equal(store.draft(repository, number, 'comment').text, commentDraft.text);
  report.stages.push({ name: 'offline-process-restart-retains-drafts', passed: true }); await close();

  report.phase = 'reconnected-read-only';
  store = await start(false); await store.load(); await store.loadIssue(repository, number, { summary: true });
  assert.equal(store.online, true); assert.equal(store.draft(repository, number, 'issue').body, issueDraft.body); assert.equal(store.draft(repository, number, 'comment').text, commentDraft.text);
  const remoteAfter = (await github.request('GET', `/repos/${repository}/issues/${number}`)).data;
  assert.equal(remoteAfter.updated_at, remoteBefore.updated_at); assert.equal(remoteAfter.comments, remoteBefore.comments); assert.equal(remoteAfter.body, remoteBefore.body);
  assert.deepEqual(localMutationCalls, ['draft-save', 'draft-save']);
  report.stages.push({ name: 'reconnect-read-only-keeps-drafts-without-publishing', passed: true, online: store.online, remoteUnchanged: true }); report.passed = true;
} catch (error) { report.failure = { code: error.code || 'ASSERTION_FAILED', message: error.message }; report.passed = false; process.exitCode = 1; }
finally {
  await close(); blocker.close(); report.deniedConnections = deniedConnections; report.localMutationCalls = localMutationCalls;
  const actual = resolve(directory), prefix = `${resolve(tmpdir())}${sep}issue-hub-offline-acceptance-`;
  if (actual.startsWith(prefix)) { try { await rm(actual, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); report.cleaned = true; } catch { report.cleanupPending = true; } }
  const filename = process.argv.includes('--preserve-proxy') ? './offline-transport-acceptance-033-proxy-preserved.json' : './offline-transport-acceptance-033.json';
  await writeFile(new URL(filename, import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
