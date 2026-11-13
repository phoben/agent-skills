import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createStorage } from '../../../../packages/issue-hub/src/storage/database.mjs';
import { createIssueService } from '../../../../packages/issue-hub/src/services/issues.mjs';
import { parseGithubRemote } from '../../../../packages/issue-hub/src/catalog.mjs';

// 只读最多5个公开已有Issue，查找已有PR引用；不制造关联或修改桌面项目。
const directory = await mkdtemp(join(tmpdir(), 'issue-hub-source-positive-'));
const storage = createStorage({ directory }), client = createGithubClient();
const github = { identity: client.identity, fingerprint: client.fingerprint, async request(method, endpoint, body) { assert.equal(method, 'GET'); assert.equal(body, undefined); return client.request(method, endpoint); } };
const report = { repository: 'openai/codex', remoteWrites: false, chatOpened: false, catalogSource: 'controlled-read-only-adapter', inspectedIssues: 0, found: null, failure: null };
try {
  const list = await github.request('GET', '/repos/openai/codex/issues?state=closed&sort=updated&direction=desc&per_page=100');
  const candidates = list.data.filter(row => !row.pull_request).slice(0, 5);
  for (const candidate of candidates) {
    report.inspectedIssues++;
    const timeline = await github.request('GET', `/repos/openai/codex/issues/${candidate.number}/timeline?per_page=100`);
    const references = timeline.data.filter(row => row.source?.issue?.pull_request);
    if (!references.length) continue;
    const entry = { ...parseGithubRemote('https://github.com/openai/codex'), workspaces: [] };
    const catalog = { snapshot: () => ({ schemaVersion: 1, status: 'complete', projects: 0, roots: 0, repositories: [entry], warnings: [] }) };
    const service = createIssueService({ github, storage, catalog });
    const summary = await service.execute('read-summary', { repositoryKey: entry.key, number: candidate.number });
    const activity = await service.execute('activity', { repositoryKey: entry.key, number: candidate.number });
    const links = activity.data.items.filter(item => item.sourceIsPr && item.sourceUrl);
    assert.ok(links.length > 0); assert.equal(summary.offline, false); assert.equal(activity.offline, false);
    report.found = { number: candidate.number, url: `https://github.com/openai/codex/issues/${candidate.number}`, attachments: summary.data.issue.attachments.length, normalizedPrLinks: new Set(links.map(item => item.sourceUrl)).size, activityComplete: activity.data.pageInfo.complete }; break;
  }
} catch (error) { report.failure = { code: error.code || 'VERIFY_FAILED', message: error.message }; process.exitCode = 1; }
finally { storage.close(); const actual = resolve(directory); if (actual.startsWith(`${resolve(tmpdir())}${sep}issue-hub-source-positive-`)) { await rm(actual, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); report.cleaned = true; } await writeFile(new URL('./source-links-positive-live-034.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
