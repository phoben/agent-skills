import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { safeFailure } from './errors.mjs';
import { VERSION } from './version.mjs';

export const UI_URI = 'ui://issue-hub/host-proof.html';
export const APP_URI = 'ui://issue-hub/app.html';

// 正式页面固定一个主入口，读取与写入分别声明可见性。
export function createIssueServer({ html, issues, tasks, diagnostics, icons = [], version = VERSION, close = async () => {} }) {
  const server = new McpServer({ name: 'issue-hub', version, icons });
  const appMeta = { ui: { resourceUri: APP_URI, visibility: ['app'] } };
  const readHints = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
  const payload = z.record(z.string(), z.unknown());
  const safe = handler => async args => {
    try {
      const value = await handler(args);
      return { structuredContent: value, content: [{ type: 'text', text: 'Issue Hub 数据已更新。' }] };
    } catch (error) {
      const failure = safeFailure(error);
      return { isError: true, structuredContent: { error: failure }, content: [{ type: 'text', text: failure.message }] };
    }
  };
  registerAppResource(server, 'Issue Hub', APP_URI, { mimeType: RESOURCE_MIME_TYPE, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } } }, async () => ({ contents: [{ uri: APP_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] }));
  registerAppTool(server, 'issue-hub-open', { title: 'Issue Hub', description: '打开仓库 Issue 管理页面。', icons, inputSchema: z.object({}).strict(), annotations: readHints, _meta: { ...appMeta, 'openai/ui': { entrypoints: [{ type: 'global' }] } } }, safe(() => issues.execute('bootstrap')));
  registerAppTool(server, 'issue-hub-query', {
    title: '读取 Issue 数据', description: '读取当前身份的仓库、Issue、评论、活动、候选及本机状态。',
    inputSchema: z.object({ action: z.enum(['bootstrap', 'list', 'read', 'read-summary', 'comments', 'activity', 'options', 'refresh', 'local-state']), payload: payload.optional() }).strict(), annotations: readHints, _meta: appMeta,
  }, safe(({ action, payload }) => issues.execute(action, payload || {})));
  registerAppTool(server, 'issue-hub-mutate', {
    title: '保存 Issue 修改', description: '根据页面中成员的明确操作保存内容和草稿，返回提交及读回状态。',
    inputSchema: z.object({ action: z.enum(['save-issue', 'change-state', 'save-comment', 'draft-save', 'preference-save', 'view-state-save', 'operation-resolve']), payload }).strict(),
    annotations: { ...readHints, readOnlyHint: false, idempotentHint: false }, _meta: appMeta,
  }, safe(({ action, payload }) => issues.execute(action, payload)));
  registerAppTool(server, 'issue-hub-task', {
    title: '打开 Issue 工作区会话', description: '恢复工作区绑定，打开预填草稿或已确认聊天，检查唯一关联；不发送提示词。',
    inputSchema: z.object({ action: z.enum(['latest', 'bind', 'open', 'check', 'open-history', 'resolve']), payload }).strict(),
    annotations: { ...readHints, readOnlyHint: false, idempotentHint: false }, _meta: appMeta,
  }, safe(({ action, payload }) => tasks.execute(action, payload)));
  registerAppTool(server, 'issue-hub-diagnostics', { title: '连接检查', description: '检查本机依赖、登录、项目接口和存储，不修改GitHub或发送会话。', inputSchema: z.object({}).strict(), annotations: readHints, _meta: appMeta }, safe(() => diagnostics.diagnose()));
  server.registerTool('issue-repositories', { title: '读取 Issue 仓库目录', description: '读取已发现 GitHub 仓库的键与名称，不包含本机工作区路径。', inputSchema: z.object({}).strict(), annotations: readHints }, safe(async () => {
    const value = await issues.execute('refresh');
    return { schemaVersion: value.schemaVersion, identity: value.identity, sampledAt: value.sampledAt, offline: value.offline, cached: value.cached, checking: value.checking, data: { repositories: value.data.repositories.map(({ key, fullName }) => ({ key, fullName })), catalog: { status: value.data.catalog?.status, warnings: value.data.catalog?.warnings, sampledAt: value.data.catalog?.sampledAt, checking: value.data.catalog?.checking } } };
  }));
  const readSchema = z.object({ repositoryKey: z.string().regex(/^[a-f0-9]{20}$/), number: z.number().int().positive() }).strict();
  server.registerTool('issue-read', { title: '读取最新 Issue', description: '读取指定仓库 Issue 正文、属性、评论与覆盖情况。仓库键来自 issue-repositories。', inputSchema: readSchema, annotations: readHints }, safe(args => issues.execute('read', args)));
  server.registerTool('issue-comments', { title: '读取 Issue 后续评论', description: '按服务返回的游标继续读取评论，直到覆盖完整。', inputSchema: readSchema.extend({ cursor: z.string().max(200).optional() }), annotations: readHints }, safe(args => issues.execute('comments', args)));
  server.server.onclose = () => { void close(); };
  return server;
}

export function createProofServer({ html, catalog, tasks, version = VERSION, maxEntries = 2, close = async () => {} }) {
  const server = new McpServer({ name: 'issue-hub', version });
  const entries = new Map();
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  const appMetadata = { ui: { resourceUri: UI_URI, visibility: ['app'] } };
  const globalMetadata = { ...appMetadata, 'openai/ui': { entrypoints: [{ type: 'global' }] } };
  registerAppResource(server, 'Issue Hub', UI_URI, { mimeType: RESOURCE_MIME_TYPE, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } } }, async () => ({ contents: [{ uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] }));
  const result = value => ({ structuredContent: value, content: [{ type: 'text', text: '宿主验证结果已更新。' }] });
  const safe = handler => async args => { try { return result(await handler(args)); } catch (error) { const failure = safeFailure(error); return { isError: true, structuredContent: { error: failure }, content: [{ type: 'text', text: JSON.stringify(failure) }] }; } };
  function view(repositoryKey = null) {
    const current = catalog.snapshot();
    return { schemaVersion: 1, stage: 'host-proof', catalog: { status: current.status, projects: current.projects, roots: current.roots, repositoryCount: current.repositories.length, diagnosticRepositoryTools: Math.min(maxEntries, current.repositories.length), diagnosticToolLimit: maxEntries, primaryEntrypoints: 1, nativeFlyoutStatus: 'unverified', warnings: current.warnings, sampledAt: current.sampledAt }, repository: repositoryKey ? current.repositories.find(entry => entry.key === repositoryKey) || null : null };
  }
  function syncEntries() {
    const selected = catalog.snapshot().repositories.slice(0, maxEntries);
    for (const [repositoryKey, registered] of entries) if (!selected.some(entry => entry.key === repositoryKey)) { registered.remove(); entries.delete(repositoryKey); }
    for (const repository of selected) {
      if (entries.has(repository.key)) continue;
      const registered = registerAppTool(server, `issue-proof-open-${repository.key}`, { title: repository.fullName, description: '读取此仓库的诊断上下文；不是原生悬浮侧栏子项。', inputSchema: z.object({}).strict(), annotations, _meta: appMetadata }, safe(() => view(repository.key)));
      entries.set(repository.key, registered);
    }
  }
  registerAppTool(server, 'issue-proof-status', { title: 'Issue Hub', description: '查看项目发现与宿主验证状态；原生悬浮仓库导航尚未验证。', inputSchema: z.object({ repositoryKey: z.string().optional() }).strict(), annotations, _meta: globalMetadata }, safe(({ repositoryKey }) => view(repositoryKey)));
  registerAppTool(server, 'issue-proof-refresh', { title: '重新发现项目', description: '只读刷新 Codex 项目和仓库诊断工具。', inputSchema: z.object({ repositoryKey: z.string().optional() }).strict(), annotations, _meta: appMetadata }, safe(async ({ repositoryKey }) => { await catalog.refresh(); syncEntries(); return view(repositoryKey); }));
  const idSchema = z.object({ requestId: z.uuid() }).strict();
  const workspaceSchema = z.object({ repositoryKey: z.string().regex(/^[a-f0-9]{20}$/), workspaceKey: z.string().regex(/^[a-f0-9]{20}$/) }).strict();
  registerAppTool(server, 'issue-proof-task-latest', { title: '恢复当前工作区验证请求', description: '只读取当前身份、仓库与工作区的最新自有验证请求，不读取聊天。', inputSchema: workspaceSchema, annotations, _meta: appMetadata }, safe(async args => ({ request: await tasks.latest(args) })));
  for (const [name, title, schema, handler] of [
    ['issue-proof-task-prepare', '准备验证草稿', z.object({ repositoryKey: z.string().regex(/^[a-f0-9]{20}$/), workspaceKey: z.string().regex(/^[a-f0-9]{20}$/), requestId: z.uuid() }).strict(), tasks.prepare],
    ['issue-proof-task-open', '打开验证草稿或关联聊天', idSchema, tasks.open],
    ['issue-proof-task-check', '检查唯一任务引用', idSchema, tasks.check],
  ]) registerAppTool(server, name, { title, description: title, inputSchema: schema, annotations: { ...annotations, readOnlyHint: false }, _meta: appMetadata }, safe(handler));
  syncEntries();
  server.server.onclose = () => { void close(); };
  return server;
}
