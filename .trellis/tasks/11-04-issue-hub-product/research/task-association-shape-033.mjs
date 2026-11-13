import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createHostBridge } from '../../../../packages/issue-hub/src/host/bridge.mjs';
import { samePath } from '../../../../packages/issue-hub/src/catalog.mjs';

// 仅检查指定请求发起之后、同工作区的有界候选，不保存消息文本。
const nonce = '9cf23987-c10c-42bb-b1e5-4b2a217ec350', marker = `任务引用：issue-hub:${nonce}`;
const bridge = createHostBridge(), github = createGithubClient();
const report = { readOnly: true, chatOpened: false, messagesSent: false, privateContentPrinted: false, candidates: [], failure: null };
let database;
function summarize(row) {
  const value = row.item || row;
  const content = Array.isArray(value.content) ? value.content : [];
  const text = content.filter(p => p.type === 'text' && typeof p.text === 'string').map(p => p.text).join('\n');
  return { rowKeys: Object.keys(row), payloadKeys: Object.keys(value), type: value.type || null, nestedObjects: Object.entries(row).filter(([,v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([key,v]) => ({ key, keys: Object.keys(v), type: v.type || null })), contentParts: content.map(p => ({ keys: Object.keys(p), type: p.type })), firstLineMatches: text.split(/\r?\n/, 1)[0] === marker, containsReference: text.includes(marker) };
}
try {
  const account = await github.identity(), identity = await bridge.identity();
  const scope = `github.com:${account.id}:codex:${createHash('sha256').update(identity).digest('hex')}`;
  database = new DatabaseSync(join(process.env.LOCALAPPDATA, 'IssueHub/data/issue-hub.sqlite'), { readOnly: true });
  const row = database.prepare('SELECT value FROM entries WHERE scope=? AND kind=? AND json_extract(value,\'$.nonce\')=?').get(scope, 'issue-task-request', nonce);
  if (!row) throw new Error('当前身份下未找到指定请求');
  const request = JSON.parse(row.value);
  const result = await bridge.request('thread/list', { cwd: request.cwd, useStateDbOnly: true, sortKey: 'created_at', sortDirection: 'desc', limit: 40 });
  const candidates = (result.data || []).filter(t => samePath(t.cwd || '', request.cwd) && t.createdAt * 1000 >= request.createdAt - 2000 && (!t.projectId || t.projectId === request.projectId));
  if (candidates.length > 3) throw new Error('候选超出本探针最小范围');
  for (const thread of candidates) {
    const items = await bridge.request('thread/items/list', { threadId: thread.id, sortDirection: 'asc', limit: 8 });
    report.candidates.push({ projectPresent: Boolean(thread.projectId), hasNext: Boolean(items.nextCursor), items: (items.data || []).map(summarize) });
  }
  if (await bridge.identity() !== identity || String((await github.identity()).id) !== String(account.id)) throw new Error('探针期间身份发生变化');
} catch (error) { report.failure = { code: error.code || 'PROBE_FAILED', message: error.message }; }
finally { database?.close(); await bridge.close(); await writeFile(new URL('./task-association-shape-033.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
