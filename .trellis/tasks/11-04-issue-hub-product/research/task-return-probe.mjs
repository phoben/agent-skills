import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2]);
const variant = process.argv[3];
assert.ok(['before', 'after'].includes(variant));
const source = name => import(pathToFileURL(join(root, 'packages/issue-hub/src', name)));
const [{ createHostBridge }, { createGithubClient }, { createCatalog }, { createIssueService }, { createIssueTasks }] = await Promise.all([
  source('host/bridge.mjs'), source('github/client.mjs'), source('catalog.mjs'), source('services/issues.mjs'), source('services/issue-tasks.mjs'),
]);
const actualBridge = createHostBridge();
const actualGithub = createGithubClient();
const db = new DatabaseSync(join(process.env.LOCALAPPDATA, 'IssueHub/data/issue-hub.sqlite'), { readOnly: true });
const counts = { githubIdentity: 0, githubFingerprint: 0, githubResources: 0, projectList: 0, threadRead: 0, fullRefresh: 0 };
let measuring = false, opened = 0;
const bridge = { ...actualBridge, request(method, params) {
  if (measuring && method === 'project/list') counts.projectList++;
  if (measuring && method === 'thread/read') counts.threadRead++;
  return actualBridge.request(method, params);
} };
const github = {
  identity() { if (measuring) counts.githubIdentity++; return actualGithub.identity(); },
  fingerprint() { if (measuring) counts.githubFingerprint++; return actualGithub.fingerprint(); },
  request(method, endpoint) { assert.equal(method, 'GET'); if (measuring) counts.githubResources++; return actualGithub.request(method, endpoint); },
};
// 只把本机验证所需的记录复制到内存，不持久化会话正文或发出导航。
const records = new Map();
const key = (scope, kind, id) => JSON.stringify([scope, kind, id]);
const storage = {
  get: (scope, kind, id) => structuredClone(records.get(key(scope, kind, id)) ?? null),
  set: (scope, kind, id, value) => records.set(key(scope, kind, id), structuredClone(value)),
  remove: (scope, kind, id) => records.delete(key(scope, kind, id)),
  list(scope, kind) {
    return [...records].flatMap(([encoded, value]) => {
      const [rowScope, rowKind, rowKey] = JSON.parse(encoded);
      return scope === rowScope && kind === rowKind ? [{ key: rowKey, value: structuredClone(value) }] : [];
    });
  },
  transaction: callback => callback(),
};
const output = { variant, navigation: 'stubbed', productionDataReadOnly: true };
try {
  const [fingerprint, codexIdentity] = await Promise.all([actualGithub.fingerprint(), actualBridge.identity()]);
  const rows = db.prepare('SELECT scope,kind,entry_key,value FROM entries WHERE scope=? AND kind=? AND entry_key=?');
  const credentials = rows.get('_identity', 'credential', fingerprint);
  assert.ok(credentials, '当前凭据没有可用的已验证账号');
  const identity = JSON.parse(credentials.value);
  const scope = `${identity.scope}:codex:${createHash('sha256').update(codexIdentity).digest('hex')}`;
  storage.set('_identity', 'credential', fingerprint, identity);
  for (const row of db.prepare("SELECT scope,kind,entry_key,value FROM entries WHERE (scope=? AND kind IN ('catalog','repository','repository-alias')) OR (scope=? AND kind IN ('issue-task-request','issue-task-index','issue-workspace-binding')) ORDER BY updated_at DESC").all(identity.scope, scope)) {
    storage.set(row.scope, row.kind, row.entry_key, JSON.parse(row.value));
  }
  const catalog = createCatalog({ bridge });
  const service = createIssueService({ github, storage, catalog });
  const issues = { ...service, execute(action, params) {
    if (measuring && action === 'refresh') counts.fullRefresh++;
    return service.execute(action, params);
  } };
  await issues.execute('bootstrap');
  const request = storage.list(scope, 'issue-task-index').map(({ value }) => storage.get(scope, 'issue-task-request', value.currentRequestId)).find(item => item?.status === 'linked' && catalog.snapshot().repositories.some(repo => repo.key === item.repositoryKey));
  assert.ok(request, '没有可核验的当前关联');
  const tasks = createIssueTasks({ bridge, catalog, storage, issues, openUri: async uri => {
    assert.equal(uri, `codex://threads/${request.threadId}`);
    opened++;
  } });
  output.catalogInitiallyChecking = Boolean(catalog.snapshot().checking);
  const start = performance.now();
  measuring = true;
  try {
    const result = await tasks.execute('open', { repositoryKey: request.repositoryKey, number: request.number, requestId: request.requestId, expectedIdentity: String(identity.account.id), reuseOnly: true });
    assert.equal(result.data.current.status, 'linked');
    assert.equal(opened, 1);
    output.passed = true;
  } finally {
    output.milliseconds = Math.round(performance.now() - start);
    output.counts = counts;
    output.navigationRequests = opened;
  }
  measuring = false;
  if (variant === 'after' && Date.now() - request.createdAt < 24 * 60 * 60 * 1000) {
    // 把同一已发送会话还原为内存中的待关联记录，核对宿主中的真实首条引用。
    storage.set(scope, 'issue-task-request', request.requestId, { ...request, status: 'requested', threadId: null });
    const associationStarted = performance.now();
    const linked = await tasks.execute('check', { requestId: request.requestId, expectedIdentity: String(identity.account.id) });
    assert.equal(linked.data.current.status, 'linked');
    assert.equal(linked.data.current.threadId, request.threadId);
    assert.equal(opened, 1);
    output.associationMilliseconds = Math.round(performance.now() - associationStarted);
    output.associationVerified = true;
  }
} catch (error) {
  output.passed = false;
  output.errorCode = error.code || error.name;
  process.exitCode = 1;
} finally {
  db.close();
  await actualBridge.close();
  await writeFile(new URL(`./task-return-${variant}.json`, import.meta.url), JSON.stringify(output, null, 2) + '\n');
  console.log(output);
}
