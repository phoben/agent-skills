// 只读本轮授权验收SQLite；只输出回执动作、时间、状态和字段摘要，不输出正文或凭据。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
const state = JSON.parse(await readFile(new URL('./live-write-state-030.json', import.meta.url), 'utf8'));
const database = new DatabaseSync(join(state.dataDirectory, 'issue-hub.sqlite'), { readOnly: true });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
try {
  const operations = database.prepare('SELECT value FROM entries WHERE scope=? AND kind=?').all(`github.com:${state.accountId}`, 'operation').map(row => JSON.parse(row.value));
  const report = operations.filter(row => row.number === state.issue.number || row.issue?.number === state.issue.number).map(row => ({ id: row.id, action: row.action, status: row.status, createdAt: row.createdAt, revision: row.issue?.revision, state: row.issue?.state, comments: row.issue?.comments, contentDigest: row.issue ? digest({ title: row.issue.title, body: row.issue.body, labels: row.issue.labels, assignees: row.issue.assignees, milestone: row.issue.milestoneNumber }) : null, commentRevisions: row.issue?.commentItems?.filter(comment => comment.id === state.commentId).map(comment => comment.updatedAt) || [] })).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  process.stdout.write(`${JSON.stringify({ issueNumber: state.issue.number, operations: report }, null, 2)}\n`);
} finally { database.close(); }
