import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createStorage } from '../../../../packages/issue-hub/src/storage/database.mjs';
import { createIssueService } from '../../../../packages/issue-hub/src/services/issues.mjs';
import { parseGithubRemote } from '../../../../packages/issue-hub/src/catalog.mjs';

// 从已有Issue只读核验真实附件/PR元数据；受控目录adapter不注册到桌面。
const directory = await mkdtemp(join(tmpdir(), 'issue-hub-source-links-'));
const storage = createStorage({ directory }), client = createGithubClient();
const report = { remoteWrites: false, chatOpened: false, contentPrinted: false, catalogSource: 'controlled-read-only-adapter', issues: [], failure: null };
const github = { identity: client.identity, fingerprint: client.fingerprint, async request(method, endpoint, body) { assert.equal(method, 'GET'); assert.equal(body, undefined); return client.request(method, endpoint); } };
try {
  for (const [repository, number] of [['phoben/agent-skills', 3], ['openai/codex', 13186]]) {
    const entry = { ...parseGithubRemote(`https://github.com/${repository}`), workspaces: [] };
    const catalog = { snapshot: () => ({ schemaVersion: 1, status: 'complete', projects: 0, roots: 0, repositories: [entry], warnings: [] }) };
    const service = createIssueService({ github, storage, catalog });
    const summary = await service.execute('read-summary', { repositoryKey: entry.key, number });
    assert.equal(summary.offline, false); const issue = summary.data.issue;
    const result = { repository, number, attachments: issue.attachments.length, activityPages: [], relatedPr: 0 };
    let cursor; const links = new Set();
    for (let page = 0; page < 3; page++) {
      const activity = await service.execute('activity', { repositoryKey: entry.key, number, ...(cursor ? { cursor } : {}) });
      for (const row of activity.data.items) if (row.sourceIsPr && row.sourceUrl) links.add(row.sourceUrl);
      result.activityPages.push({ loaded: activity.data.items.length, complete: activity.data.pageInfo.complete });
      cursor = activity.data.pageInfo.nextCursor; if (!cursor) break;
    }
    result.relatedPr = links.size; result.limited = Boolean(cursor); report.issues.push(result);
  }
} catch (error) { report.failure = { code: error.code || 'VERIFY_FAILED', message: error.message }; process.exitCode = 1; }
finally { storage.close(); const actual = resolve(directory); if (actual.startsWith(`${resolve(tmpdir())}${sep}issue-hub-source-links-`)) { await rm(actual, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); report.cleaned = true; } await writeFile(new URL('./source-links-live-034.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
