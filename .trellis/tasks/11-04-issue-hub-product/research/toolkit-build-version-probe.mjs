import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// 只覆盖构建目标并核对版本，不调用业务工具；最后恢复正常YG清单版本。
const root = 'E:/Develop/agent-skills/.worktrees/issue-hub-in-yg-20261104';
const { Client } = await import(pathToFileURL(join(root, 'packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(join(root, 'packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
const directory = await mkdtemp(join(tmpdir(), 'yg-target-version-'));
const report = { requestedVersion: '0.3.1', remoteWrites: false, chatOpened: false, services: [], passed: false, failure: null };
const clients = [];
const build = env => execFileSync(process.execPath, [join(root, 'packages/token-usage/scripts/build.mjs')], { cwd: root, windowsHide: true, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  report.manifestVersion = JSON.parse(await readFile(join(root, 'plugins/yg-toolkit/plugin.json'), 'utf8')).version;
  build({ ...process.env, YG_TOKEN_BUILD_VERSION: report.requestedVersion });
  for (const [name, prefix] of [['token-usage.cjs', '// YG Toolkit 版本: '], ['token-usage.html', '<!-- YG Toolkit 版本: '], ['issue-hub.cjs', '// Issue Hub 版本: '], ['issue-hub.html', '<!-- Issue Hub 版本: ']]) {
    const text = await readFile(join(root, 'plugins/yg-toolkit/dist', name), 'utf8');
    assert.equal(text.split(/\r?\n/, 1)[0], `${prefix}${report.requestedVersion}${name.endsWith('.html') ? ' -->' : ''}`);
  }
  for (const file of ['token-usage.cjs', 'issue-hub.cjs']) {
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'plugins/yg-toolkit/dist', file)], cwd: directory, stderr: 'pipe', env: { ...process.env, CODEX_HOME: join(directory, 'profile'), ISSUE_HUB_DATA_DIR: join(directory, 'data') } });
    transport.stderr?.on('data', () => {});
    const client = new Client({ name: 'yg-build-target-check', version: '1' }); clients.push(client); await client.connect(transport);
    assert.equal(client.getServerVersion().version, report.requestedVersion); report.services.push({ file, version: client.getServerVersion().version });
  }
  assert.equal(JSON.parse(await readFile(join(root, 'plugins/yg-toolkit/plugin.json'), 'utf8')).version, report.manifestVersion);
  report.passed = true;
} catch (error) { report.failure = { code: error.code || 'VERIFY_FAILED', message: error.message }; process.exitCode = 1; }
finally {
  for (const client of clients) await client.close();
  const env = { ...process.env }; delete env.YG_TOKEN_BUILD_VERSION; build(env); report.normalBuildRestored = true;
  const actual = resolve(directory); if (actual.startsWith(`${resolve(tmpdir())}${sep}yg-target-version-`)) await rm(actual, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  await writeFile(new URL('./toolkit-build-version-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(report);
}
