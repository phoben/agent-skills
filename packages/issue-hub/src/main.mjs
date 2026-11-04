import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHostBridge } from './host/bridge.mjs';
import { createCatalog } from './catalog.mjs';
import { createStorage } from './storage/database.mjs';
import { createGithubClient } from './github/client.mjs';
import { createIssueService } from './services/issues.mjs';
import { createIssueTasks } from './services/issue-tasks.mjs';
import { createIssueImages } from './services/images.mjs';
import { createIssueServer } from './server.mjs';
import { VERSION } from './version.mjs';
import { createIssueHubIcons } from './icons.mjs';
import { createRuntimeDiagnostics } from './diagnostics.mjs';

const bridge = createHostBridge();
async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('需要 Node 24');
  const catalog = createCatalog({ bridge });
  // 先建立MCP连接；完整项目扫描由界面后台刷新或模型完整目录查询按需触发。
  const directory = process.env.ISSUE_HUB_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'IssueHub', 'data');
  const github = createGithubClient();
  const diagnostics = createRuntimeDiagnostics({bridge,github,catalog,directory});
  if(process.argv.slice(2).includes('--doctor')){
    try{const result=await diagnostics.diagnose();process.stdout.write(`${JSON.stringify(result,null,2)}\n`);if(result.data.status==='error')process.exitCode=1;}finally{await bridge.close();}return;
  }
  const html = await readFile(join(dirname(process.argv[1]), 'issue-hub.html'), 'utf8');
  const icons = createIssueHubIcons(await readFile(join(dirname(process.argv[1]), '..', 'assets', 'issue-hub.svg'), 'utf8'));
  const storage = createStorage({ directory });
  const issues = createIssueService({ github, storage, catalog });
  const tasks = createIssueTasks({ bridge, catalog, storage, issues });
  const images = createIssueImages({ github, issues });
  let closed = false;
  const cleanup = async () => { if (closed) return; closed = true; storage.close(); await bridge.close(); };
  const server = createIssueServer({ html, issues, tasks, images, diagnostics, icons, version: VERSION, close: cleanup });
  await server.connect(new StdioServerTransport());
  const close = async () => { await server.close(); await cleanup(); };
  process.stdin.once('end', close); process.once('SIGINT', close); process.once('SIGTERM', close);
}
main().catch(async () => { await bridge.close(); process.stderr.write('Issue Hub 启动失败，请检查 Node 24、Git、gh、Codex 和本机存储权限。\n'); process.exitCode = 1; });
