// 使用agent-reach的GitHub CLI后端，只核对公开已有评论的分页元数据，不检查或输出正文。
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createStorage } from '../../../../packages/issue-hub/src/storage/database.mjs';
import { createIssueService } from '../../../../packages/issue-hub/src/services/issues.mjs';
import { parseGithubRemote } from '../../../../packages/issue-hub/src/catalog.mjs';

const repository = 'openai/codex', maximumPages = 10;
const output = new URL('./comments-live-030.json', import.meta.url);
const report = { checkedAt: new Date().toISOString(), repository, realGithub: true, remoteWrites: false, chatOpened: false, catalogSource: '受控只读服务层测试adapter，不注册或修改桌面项目', maximumPages, candidateSearch: { endpoint: '/repos/openai/codex/issues?state=all&per_page=100&sort=comments&direction=desc', inspected: 0 }, issue: null, pages: [], loadedComments: 0, duplicateIds: 0, complete: false, nextCursor: null, limited: false, rateLimit: { minimumRemaining: null }, temporaryStorageRemoved: false, passed: false, failure: null };
const client = createGithubClient();
const github = {
  fingerprint: client.fingerprint,
  identity: client.identity,
  async request(method, endpoint, body) {
    assert.equal(method, 'GET', '本验证只允许GET'); assert.equal(body, undefined, '只读验证不发送请求正文');
    const response = await client.request(method, endpoint);
    const remaining = Number(response.headers?.['x-ratelimit-remaining']);
    if (Number.isFinite(remaining) && response.headers?.['x-ratelimit-remaining'] !== undefined) report.rateLimit.minimumRemaining = report.rateLimit.minimumRemaining === null ? remaining : Math.min(report.rateLimit.minimumRemaining, remaining);
    return response;
  },
};
let storage, directory;
try {
  const listed = await github.request('GET', report.candidateSearch.endpoint);
  assert.ok(Array.isArray(listed.data), '候选列表必须为数组'); report.candidateSearch.inspected = listed.data.length;
  const candidates = listed.data.filter(item => !item.pull_request && Number.isSafeInteger(item.number) && item.comments > 100);
  const preferred = candidates.filter(item => item.comments <= 300).sort((left, right) => left.comments - right.comments);
  const selected = preferred[0] || [...candidates].sort((left, right) => left.comments - right.comments)[0];
  assert.ok(selected, '前100项没有可用的已有>100评论Issue；不制造评论');
  report.issue = { number: selected.number, url: `https://github.com/${repository}/issues/${selected.number}`, commentsAtSelection: selected.comments, preferred101To300: selected.comments <= 300 };
  const temporaryRoot = await realpath(tmpdir());
  directory = await mkdtemp(join(temporaryRoot, 'issue-hub-comments-live-'));
  storage = createStorage({ directory });
  const entry = { ...parseGithubRemote(`https://github.com/${repository}.git`), workspaces: [] };
  const catalog = { snapshot: () => ({ schemaVersion: 1, status: 'complete', projects: 0, roots: 0, repositories: [entry], warnings: [], sampledAt: new Date().toISOString() }) };
  const service = createIssueService({ github, storage, catalog });
  const ids = new Set(), cursors = new Set(); let cursor;
  for (let index = 0; index < maximumPages; index++) {
    const result = await service.execute('comments', { repositoryKey: entry.key, number: selected.number, ...(cursor ? { cursor } : {}) });
    assert.equal(result.offline, false, '真实分页不允许以离线缓存替代');
    assert.equal(result.cached, false, '此轮独立临时库应从GitHub真实读取');
    const { items, pageInfo } = result.data;
    assert.ok(Array.isArray(items) && pageInfo, '分页响应必须有items和覆盖信息');
    for (const item of items) { assert.ok(Number.isSafeInteger(item.id), '评论必须有稳定数值ID'); if (ids.has(item.id)) report.duplicateIds++; ids.add(item.id); }
    report.pages.push({ page: index + 1, loaded: items.length, complete: pageInfo.complete, nextCursor: pageInfo.nextCursor });
    report.loadedComments += items.length; report.complete = pageInfo.complete; report.nextCursor = pageInfo.nextCursor;
    if (!pageInfo.nextCursor) { assert.equal(pageInfo.complete, true, '无next时须明确完整'); break; }
    assert.equal(pageInfo.complete, false, '有next不能宣称完整'); assert.ok(!cursors.has(pageInfo.nextCursor), '分页游标不得重复');
    cursors.add(pageInfo.nextCursor); cursor = pageInfo.nextCursor;
  }
  report.limited = Boolean(report.nextCursor);
  assert.ok(report.loadedComments > 100, '必须实际读到超过100条已有评论');
  assert.equal(report.duplicateIds, 0, '真实多页评论ID不得重复');
  report.passed = report.complete && !report.limited;
  if (report.limited) report.failure = { code: 'PAGE_LIMIT_PARTIAL', message: '已到十页上限，保留部分覆盖，不宣称全部。' };
} catch (error) {
  report.failure = { code: error.code || 'READONLY_VERIFICATION_FAILED', message: error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : '真实只读分页验证未完成；未执行写入。', ...(error.retryAt ? { retryAt: error.retryAt } : {}) };
} finally {
  storage?.close();
  if (directory) {
    const temporaryRoot = await realpath(tmpdir()), actual = await realpath(directory), child = relative(temporaryRoot, actual);
    assert.ok(child.startsWith('issue-hub-comments-live-') && !child.includes(sep) && !child.startsWith('..'), '临时清理路径必须在已验证前缀内');
    await rm(actual, { recursive: true, force: true }); report.temporaryStorageRemoved = true;
  }
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
