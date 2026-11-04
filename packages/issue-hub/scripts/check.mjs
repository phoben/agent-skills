import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (entry.name.endsWith('.mjs')) { execFileSync(process.execPath, ['--check', path], { stdio: 'pipe', windowsHide: true }); count++; }
  }
}
for (const name of ['src', 'ui', 'scripts', 'test']) await check(join(root, name));
process.stdout.write(`${count} 个 JavaScript 模块语法检查通过。\n`);
