import { directoryDigest, pluginSkill, sourceSkill } from "./skill-files.mjs";

const [sourceHash, targetHash] = await Promise.all([
  directoryDigest(sourceSkill),
  directoryDigest(pluginSkill),
]);
if (sourceHash !== targetHash) {
  throw new Error(
    `DataPull Skill 副本不同步。源码=${sourceHash}，Plugin=${targetHash}。请运行 npm run skill:sync。`,
  );
}
process.stdout.write(`DataPull Skill 副本一致：${sourceHash}\n`);
