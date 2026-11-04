import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHostBridge } from '../src/host/bridge.mjs';
import { createCatalog, inspectGit } from '../src/catalog.mjs';
import { createStorage } from '../src/storage/database.mjs';
import { createGithubClient } from '../src/github/client.mjs';
import { createIssueService } from '../src/services/issues.mjs';

// 只核对真实读取与计数，不写GitHub、不打开聊天、不打印私有正文或路径。
const bridge = createHostBridge();
const directory = await mkdtemp(join(tmpdir(), 'issue-hub-live-'));
const storage = createStorage({ directory });
const result = { schemaVersion: 1, source: 'real-projects-and-github', remoteWrites: false, chatOpened: false, contentPrinted: false, desktopCompared: false, secondMachineVerified: false };
try {
  const catalog = createCatalog({ bridge });
  const value = await catalog.refresh();
  result.projects = value.projects; result.roots = value.roots; result.repositoriesDiscovered = value.repositories.length;
  result.catalogStatus = value.status;
  result.warnings = Object.fromEntries([...new Set(value.warnings)].map(code => [code, value.warnings.filter(entry => entry === code).length]));
  const issues = createIssueService({ github: createGithubClient(), storage, catalog });
  const bootstrap = await issues.execute('bootstrap');
  result.identityVerified = Boolean(bootstrap.identity); result.repositoriesCanonical = bootstrap.data.repositories.length;
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const local = await inspectGit(repositoryRoot);
  const candidate = bootstrap.data.repositories.find(repo => repo.access !== 'unavailable' && (process.env.ISSUE_HUB_VERIFY_REPOSITORY ? repo.fullName.toLowerCase() === process.env.ISSUE_HUB_VERIFY_REPOSITORY.toLowerCase() : local.repositories.some(entry => entry.fullName.toLowerCase() === repo.fullName.toLowerCase())));
  if (!candidate) throw Object.assign(new Error('没有可读取的当前项目仓库'), { code: 'VERIFY_REPOSITORY_UNAVAILABLE' });
  const list = await issues.execute('list', { repositoryKey: candidate.key, state: 'all' });
  result.listRead = true; result.loadedIssues = list.data.issues.length; result.listComplete = list.data.pageInfo.complete;
  if (list.data.issues[0]) {
    const detail = await issues.execute('read', { repositoryKey: candidate.key, number: list.data.issues[0].number });
    const issue = detail.data.issue;
    result.nonemptyDetailRead = true; result.bodyBytes = Buffer.byteLength(issue.body || '');
    result.commentsLoaded = issue.commentItems.length; result.activitiesLoaded = issue.activities.length; result.coverage = issue.coverage;
  } else { result.nonemptyDetailRead = false; }
} catch (error) { result.error = error.code || 'LIVE_VERIFY_FAILED'; process.exitCode = 1; }
finally {
  storage.close(); await bridge.close();
  if (resolve(directory).startsWith(`${resolve(tmpdir())}${sep}issue-hub-live-`)) await rm(directory, { recursive: true, force: true });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
