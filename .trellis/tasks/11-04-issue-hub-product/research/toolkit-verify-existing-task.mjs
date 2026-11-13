import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createHostBridge } from '../../../../packages/issue-hub/src/host/bridge.mjs';
import { samePath } from '../../../../packages/issue-hub/src/catalog.mjs';

// 只恢复用户此前已确认的自有请求；不新建、打开或发送聊天，不回放写入。
const nonce = '9cf23987-c10c-42bb-b1e5-4b2a217ec350';
const bridge = createHostBridge(), github = createGithubClient(), report = { version: '0.3.0', remoteWrites: false, chatOpened: false, messagesSent: false, failure: null };
let database, client;
try {
  const account = await github.identity(), identity = await bridge.identity();
  const scope = `github.com:${account.id}:codex:${createHash('sha256').update(identity).digest('hex')}`;
  database = new DatabaseSync(join(process.env.LOCALAPPDATA, 'IssueHub/data/issue-hub.sqlite'), { readOnly: true });
  const row = database.prepare('SELECT value FROM entries WHERE scope=? AND kind=? AND json_extract(value,\'$.nonce\')=?').get(scope, 'issue-task-request', nonce); assert.ok(row);
  const old = JSON.parse(row.value); assert.equal(old.codexIdentity, identity); assert.equal(old.githubAccountId, account.id); database.close(); database = null;
  const filename = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'plugins/cache/yg/yg-toolkit/0.3.0/dist/issue-hub.cjs');
  const transport = new StdioClientTransport({ command: process.execPath, args: [filename], stderr: 'pipe', env: { ...process.env } }); transport.stderr?.on('data', () => {});
  client = new Client({ name: 'yg_existing_issue_task_check', version: '1' }); await client.connect(transport, { timeout: 120000 }); assert.equal(client.getServerVersion().version, '0.3.0');
  async function call(name, action, payload = {}) { const result = await client.callTool({ name, arguments: { action, payload } }, undefined, { timeout: 120000 }); if (result.isError) throw Object.assign(new Error(result.structuredContent.error.message), result.structuredContent.error); return result.structuredContent; }
  await call('issue-hub-query', 'bootstrap'); await call('issue-hub-query', 'refresh');
  const result = await call('issue-hub-task', 'latest', { repositoryKey: old.repositoryKey, number: old.number });
  const current = result.data.current; assert.equal(current.requestId, old.requestId); assert.equal(current.threadId, old.threadId); assert.equal(current.status, 'linked'); assert.equal(current.reference, `任务引用：issue-hub:${nonce}`); assert.ok(samePath(current.path, old.cwd));
  const target = await bridge.request('thread/read', { threadId: old.threadId, includeTurns: false }); assert.equal(target.thread.id, old.threadId); assert.ok(samePath(target.thread.cwd, old.cwd));
  report.result = { currentRequestRestored: true, status: current.status, sameThread: true, referenceMatches: true, originalWorkspace: true, bindingValid: result.data.binding?.valid === true };
  assert.equal(await bridge.identity(), identity); report.passed = true;
} catch (error) { report.failure = { code: error.code || 'RESTORE_FAILED', message: error.message }; report.passed = false; process.exitCode = 1; }
finally { database?.close(); await client?.close(); await bridge.close(); await writeFile(new URL('./toolkit-existing-task.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
