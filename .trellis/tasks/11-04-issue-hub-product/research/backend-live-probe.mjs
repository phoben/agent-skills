// 只读真实连通性检查：仅输出安全状态和计数，不输出凭据、账号或 Issue 内容。
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { inspectGit } from '../../../../packages/issue-hub/src/catalog.mjs';
const github = createGithubClient();
const report = { user: null, metadata: null, list: null };
try { const user = await github.identity(); report.user = { ok: Boolean(user.id), fingerprintAvailable: Boolean(user.credentialFingerprint) }; }
catch (error) { report.user = { ok: false, code: error.code || 'INTERNAL_ERROR' }; }
try {
  const repositories = (await inspectGit('E:/Develop/agent-skills')).repositories;
  if (repositories[0]) {
    const response = await github.request('GET', `/repos/${repositories[0].fullName}`);
    report.metadata = { ok: true, status: response.status, hasIssues: response.data.has_issues };
    const list = await github.request('GET', `/repos/${repositories[0].fullName}/issues?state=all&per_page=1&page=1`);
    report.list = { ok: true, status: list.status, count: list.data.length };
  }
} catch (error) { report.metadata ??= { ok: false, code: error.code || 'INTERNAL_ERROR' }; }
process.stdout.write(`${JSON.stringify(report)}\n`);
