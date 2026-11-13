import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createHostBridge } from '../../../../packages/issue-hub/src/host/bridge.mjs';
import { samePath } from '../../../../packages/issue-hub/src/catalog.mjs';

// 仅核验当前双身份下的用户指定任务引用，输出形状/布尔值，不输出消息正文。
const nonce = '9cf23987-c10c-42bb-b1e5-4b2a217ec350';
const report = { readOnly: true, chatOpened: false, messagesSent: false, privateContentPrinted: false, queries: [], failure: null };
const bridge = createHostBridge(), github = createGithubClient();
let database;
try {
  const account = await github.identity(), identity = await bridge.identity();
  const scope = `github.com:${account.id}:codex:${createHash('sha256').update(identity).digest('hex')}`;
  database = new DatabaseSync(join(process.env.LOCALAPPDATA, 'IssueHub/data/issue-hub.sqlite'), { readOnly: true });
  const rows = database.prepare('SELECT entry_key,value FROM entries WHERE scope=? AND kind=? AND json_extract(value,\'$.nonce\')=?').all(scope, 'issue-task-request', nonce);
  if (rows.length !== 1) throw new Error('当前身份下未找到唯一指定请求');
  const request = JSON.parse(rows[0].value);
  if (request.codexIdentity !== identity || String(request.githubAccountId) !== String(account.id)) throw new Error('请求身份核对失败');
  report.request = { status: request.status, createdAt: new Date(request.createdAt).toISOString(), coverage: request.coverage, checkedCandidates: request.checkedCandidates, knownCandidates: request.candidates?.length || 0, hasThread: Boolean(request.threadId) };
  const seen = new Set(), recent = [];
  for (const [variant, parameters] of [
    ['current-project-state', { cwd: request.cwd, projectId: request.projectId, useStateDbOnly: true }],
    ['cwd-state', { cwd: request.cwd, useStateDbOnly: true }],
    ['cwd-default', { cwd: request.cwd }],
  ]) {
    const result = await bridge.request('thread/list', { ...parameters, sortKey: 'created_at', sortDirection: 'desc', limit: 40 });
    const data = result.data || [];
    report.queries.push({ variant, count: data.length, hasNext: Boolean(result.nextCursor), exactCwd: data.filter(t => samePath(t.cwd || '', request.cwd)).length, inTime: data.filter(t => Number.isFinite(t.createdAt) && t.createdAt * 1000 >= request.createdAt - 2000).length, matchingProject: data.filter(t => !t.projectId || t.projectId === request.projectId).length });
    for (const thread of data) {
      if (!seen.has(thread.id) && typeof thread.cwd === 'string' && samePath(thread.cwd, request.cwd) && Number.isFinite(thread.createdAt) && thread.createdAt * 1000 >= request.createdAt - 24 * 60 * 60 * 1000 && recent.length < 8) { seen.add(thread.id); recent.push(thread); }
    }
  }
  report.initialItems = [];
  for (const thread of recent) {
    const result = await bridge.request('thread/items/list', { threadId: thread.id, sortDirection: 'asc', limit: 8 });
    const users = (result.data || []).filter(item => item.type === 'userMessage');
    const marker = `任务引用：issue-hub:${nonce}`;
    const summaries = users.map(item => {
      const parts = (item.content || []).filter(p => p.type === 'text' && typeof p.text === 'string');
      const text = parts.map(p => p.text).join('\n');
      return { keys: Object.keys(item), textParts: parts.length, firstLineMatches: text.split(/\r?\n/, 1)[0] === marker, containsReference: text.includes(marker), startsAgentsContext: /^# AGENTS\.md|^<environment_context>|^<INSTRUCTIONS>/.test(text), firstLineLength: text.split(/\r?\n/, 1)[0].length };
    });
    report.initialItems.push({ requestTimeDeltaMs: thread.createdAt * 1000 - request.createdAt, projectPresent: Boolean(thread.projectId), projectMatches: !thread.projectId || thread.projectId === request.projectId, types: (result.data || []).map(i => i.type), hasNext: Boolean(result.nextCursor), users: summaries });
  }
  if (await bridge.identity() !== identity || String((await github.identity()).id) !== String(account.id)) throw new Error('探针期间身份发生变化');
} catch (error) { report.failure = { code: error.code || 'PROBE_FAILED', message: error.message }; }
finally { database?.close(); await bridge.close(); await writeFile(new URL('./task-association-probe-033.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
