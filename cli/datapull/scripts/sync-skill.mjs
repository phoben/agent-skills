import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  directoryDigest,
  pluginSkill,
  repositoryRoot,
  sourceSkill,
} from "./skill-files.mjs";

const allowedRoot = resolve(repositoryRoot, "plugins", "yg-toolkit", "skills");
if (!pluginSkill.startsWith(`${allowedRoot}${sep}`)) {
  throw new Error(`拒绝同步到预期目录之外：${pluginSkill}`);
}

await rm(pluginSkill, { force: true, recursive: true });
await mkdir(dirname(pluginSkill), { recursive: true });
await cp(sourceSkill, pluginSkill, { recursive: true, errorOnExist: true });

const sourceHash = await directoryDigest(sourceSkill);
const targetHash = await directoryDigest(pluginSkill);
if (sourceHash !== targetHash) throw new Error("DataPull Skill 同步后哈希不一致。");
process.stdout.write(`DataPull Skill 已同步：${sourceHash}\n`);
