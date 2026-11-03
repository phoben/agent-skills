import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { dashboardShape, sessionsShape, safeFailure } from './contracts.mjs';
import { createUsageService } from './service.mjs';
import { usageIcons } from './icons.mjs';

export const UI_URI = 'ui://yg-toolkit/token-usage.html';
export function createUsageServer({ html, service = createUsageService(), version = '0.2.0' }) {
  const server = new McpServer({ name: 'yg-token-usage', version, icons: usageIcons });
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  registerAppResource(server, 'Tokens Usage', UI_URI, { mimeType: RESOURCE_MIME_TYPE, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } } }, async () => ({ contents: [{ uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] }));
  registerAppTool(server, 'token_usage_open', {
    title: 'Tokens 用量', description: '打开当前账号与本机项目的 Tokens 用量页面。', annotations,
    inputSchema: {}, _meta: { ui: { resourceUri: UI_URI }, 'openai/ui': { entrypoints: [{ type: 'global' }] } },
  }, async () => ({ content: [{ type: 'text', text: '用量页面已准备好，将按当前登录账号读取统计。' }] }));
  const ui = { ui: { resourceUri: UI_URI, visibility: ['app'] } };
  function query(name, title, description, inputSchema, method) {
    registerAppTool(server, name, { title, description, inputSchema, annotations, _meta: ui }, async args => {
      try { return { structuredContent: await service[method](args), content: [{ type: 'text', text: '用量查询已完成。' }] }; }
      catch (error) { const failure = safeFailure(error); return { isError: true, structuredContent: { error: failure }, content: [{ type: 'text', text: JSON.stringify(failure) }] }; }
    });
  }
  query('token_usage_dashboard', '查询用量总览', '读取当前账号官方汇总和本机项目逐日统计。', dashboardShape, 'dashboard');
  query('token_usage_sessions', '查询会话用量', '按项目和日期分页查看会话分项用量。', sessionsShape, 'sessions');
  server.server.onclose = () => { void service.close(); };
  return server;
}
