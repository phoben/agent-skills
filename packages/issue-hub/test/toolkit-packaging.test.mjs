import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { VERSION } from '../src/version.mjs';

const root = new URL('../../../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('市场保留YG安装条目，Issue不再独立注册而由单包提供两个MCP', async () => {
  const marketplace = await json('.agents/plugins/marketplace.json');
  assert.equal(marketplace.plugins.filter(plugin => plugin.name === 'yg-toolkit').length, 1);
  assert.ok(!marketplace.plugins.some(plugin => plugin.name === 'issue-hub'));
  const mcp = await json('plugins/yg-toolkit/mcp.json');
  assert.deepEqual(Object.keys(mcp.mcpServers).sort(), ['issue-hub', 'yg-token-usage']);
  assert.deepEqual(mcp.mcpServers['issue-hub'].args, ['${PLUGIN_ROOT}/dist/issue-hub.cjs']);
  assert.deepEqual(mcp.mcpServers['yg-token-usage'].args, ['${PLUGIN_ROOT}/dist/token-usage.cjs']);
});

test('Issue源码与两服务构建版本归属于YG双清单，旧独立插件不再分发', async () => {
  const manifest = await json('plugins/yg-toolkit/plugin.json');
  const compatibility = await json('plugins/yg-toolkit/.codex-plugin/plugin.json');
  assert.equal(manifest.name, compatibility.name);
  assert.equal(manifest.version, compatibility.version);
  assert.equal(VERSION, manifest.version);
  await assert.rejects(access(new URL('plugins/issue-hub/plugin.json', root)), { code: 'ENOENT' });
});

test('YG自包含包同时带两页面与独立许可，四份运行产物版本标记一致', async () => {
  const manifest = await json('plugins/yg-toolkit/plugin.json');
  for (const name of ['token-usage.cjs', 'token-usage.html', 'THIRD-PARTY-LICENSES.txt', 'issue-hub.cjs', 'issue-hub.html', 'issue-hub-THIRD-PARTY-LICENSES.txt']) {
    assert.ok((await readFile(new URL(`plugins/yg-toolkit/dist/${name}`, root))).length > 0, `${name}必须随一个YG包交付`);
  }
  for (const [file, label] of [['token-usage.cjs', 'YG Toolkit'], ['token-usage.html', 'YG Toolkit'], ['issue-hub.cjs', 'Issue Hub'], ['issue-hub.html', 'Issue Hub']]) {
    const text = await readFile(new URL(`plugins/yg-toolkit/dist/${file}`, root), 'utf8');
    const expected = file.endsWith('.html') ? `<!-- ${label} 版本: ${manifest.version} -->` : `// ${label} 版本: ${manifest.version}`;
    assert.equal(text.split(/\r?\n/, 1)[0], expected);
  }
});
