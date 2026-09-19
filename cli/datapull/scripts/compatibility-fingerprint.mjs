import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const compatibilityInputs = [
  "package-lock.json",
  "src/config",
  "src/connections",
  "src/core",
  "src/exporters",
  "src/output",
  "src/process",
  "src/providers",
  "src/pull",
  "src/tools",
  "src/types.ts",
  "src/utils",
  "resources/ci",
  "resources/export-sqlserver.ps1",
  "scripts/compatibility-fingerprint.mjs",
  "scripts/ci/run-compatibility.mjs",
];

export async function compatibilityFingerprint() {
  const files = [];
  for (const input of compatibilityInputs) {
    await collect(resolve(packageRoot, input), files);
  }
  files.sort((left, right) => left.localeCompare(right, "en"));
  const hash = createHash("sha256");
  for (const file of files) {
    const name = relative(packageRoot, file).split(sep).join("/");
    hash.update(name);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function collect(path, files) {
  const metadata = await stat(path);
  if (metadata.isFile()) {
    files.push(path);
    return;
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) await collect(child, files);
    else if (entry.isFile()) files.push(child);
  }
}
