import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createHostBridge } from '../../../../packages/issue-hub/src/host/bridge.mjs';
import { samePath } from '../../../../packages/issue-hub/src/catalog.mjs';

// 只对用户明确指定、当前双身份下的已有请求执行check；不打开、不发送、不另建。
const nonce = '9cf23987-c10c-42bb-b1e5-4b2a217ec350';
const report = { githubWrites: false, chatOpened: false, messagesSent: false, localAssociationCheck: true, privateContentPrinted: false, failure: null };
const bridge = createHostBridge(), github = createGithubClient();
let database, client;
try {
  const account = await github.identity(), identity = await bridge.identity();
  const scope = `github.com:${account.id}:codex:${createHash('sha256').update(identity).digest('hex')}`;
  database = new DatabaseSync(join(process.env.LOCALAPPDATA, 'IssueHub/data/issue-hub.sqlite'), { readOnly: true });
  const row = database.prepare('SELECT value FROM entries WHERE scope=? AND kind=? AND json_extract(value,\'$.nonce\')=?').get(scope, 'issue-task-request', nonce);
  if (!row) throw new Error('当前双身份下没有该请求');
  const request = JSON.parse(row.value);
  if (request.codexIdentity !== identity || String(request.githubAccountId) !== String(account.id)) throw new Error('请求身份不匹配');
  database.close(); database = null; await bridge.close();
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('plugins/issue-hub/dist/issue-hub.cjs')], cwd: resolve('packages/issue-hub'), stderr: 'pipe', env: { ...process.env } });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'issue-hub-owned-association-check', version: '1' }); await client.connect(transport, { timeout: 120000 });
  report.version = client.getServerVersion()?.version;
  const result = await client.callTool({ name: 'issue-hub-task', arguments: { action: 'check', payload: { requestId: request.requestId, expectedIdentity: String(account.id) } } }, undefined, { timeout: 120000 });
  if (result.isError) throw Object.assign(new Error(result.structuredContent.error.message), result.structuredContent.error);
  const data = result.structuredContent.data;
  const current = data.current;
  if (current?.requestId !== request.requestId || current.repositoryKey !== request.repositoryKey || current.number !== request.number) throw new Error('返回对象不属于指定请求');
  report.result = { status: current.status, coverage: current.coverage, checkedCandidates: current.checkedCandidates, candidates: current.candidates?.length || 0, hasThread: Boolean(current.threadId), referenceMatches: current.reference === `任务引用：issue-hub:${nonce}` };
  if (process.argv.includes('--after') && !(current.status === 'linked' && current.threadId && current.coverage === 'complete' && report.result.referenceMatches)) throw new Error('修复后真实请求仍未完整关联');
  if (process.argv.includes('--after')) {
    const verifyBridge = createHostBridge();
    try {
      if (await verifyBridge.identity() !== identity) throw new Error('返回目标验证期间身份变化');
      const target = await verifyBridge.request('thread/read', { threadId: current.threadId, includeTurns: false });
      report.result.returnTargetVerified = target.thread?.id === current.threadId && typeof target.thread.cwd === 'string' && samePath(target.thread.cwd, request.cwd) && (!target.thread.projectId || target.thread.projectId === request.projectId);
      if (!report.result.returnTargetVerified) throw new Error('关联返回目标不再属于原工作区');
    } finally { await verifyBridge.close(); }
  }
} catch (error) { report.failure = { code: error.code || 'CHECK_FAILED', message: error.message }; process.exitCode = 1; }
finally {
  database?.close(); await bridge.close(); await client?.close();
  const variant = process.argv.includes('--after') ? 'after' : 'before';
  await writeFile(new URL(`./task-association-live-check-033-${variant}.json`, import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
