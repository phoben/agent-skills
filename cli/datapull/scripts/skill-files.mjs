import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

export const packageRoot = resolve(import.meta.dirname, "..");
export const repositoryRoot = resolve(packageRoot, "..", "..");
export const sourceSkill = resolve(packageRoot, "skill");
export const pluginSkill = resolve(
  repositoryRoot,
  "plugins",
  "yg-toolkit",
  "skills",
  "datapull",
);

export async function directoryDigest(directory) {
  const hash = createHash("sha256");
  const files = await listFiles(directory);
  for (const file of files) {
    hash.update(relative(directory, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function listFiles(directory) {
  const result = [];
  const visit = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) result.push(path);
      else throw new Error(`Skill 目录包含不支持的文件类型：${path}`);
    }
  };
  await visit(directory);
  return result;
}
