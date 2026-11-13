import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = dirname(fileURLToPath(import.meta.url));
const source = resolve(directory, '../../../../plugins/issue-hub');
const { version } = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8'));
const installed = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'plugins/cache/yg/issue-hub', version);
const paths = ['plugin.json', '.codex-plugin/plugin.json', 'mcp.json', 'LICENSE', 'assets/icon.svg', 'dist/issue-hub.cjs', 'dist/app.html', 'dist/THIRD-PARTY-LICENSES.txt'];
const files = [];
for (const path of paths) {
  const digest = data => createHash('sha256').update(data).digest('hex');
  const expected = digest(await readFile(join(source, path)));
  const actual = digest(await readFile(join(installed, path)));
  files.push({ path, sourceSha256: expected, installedSha256: actual, equal: expected === actual });
}
const result = { checkedAt: new Date().toISOString(), version, files, allEqual: files.every(file => file.equal) };
await writeFile(join(directory, `installed-hashes-${version}.json`), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ version, files: files.length, allEqual: result.allEqual }));
if (!result.allEqual) process.exitCode = 1;
