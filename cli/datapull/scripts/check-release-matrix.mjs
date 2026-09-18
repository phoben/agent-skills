import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "..", "resources", "compatibility-matrix.json");
const matrix = JSON.parse(await readFile(path, "utf8"));
if (
  matrix.version !== 1 ||
  !Array.isArray(matrix.requiredPlatforms) ||
  !Array.isArray(matrix.requiredEngines) ||
  !Array.isArray(matrix.requiredSkillTargets) ||
  !Array.isArray(matrix.verified) ||
  !Array.isArray(matrix.platformVerifications)
) {
  throw new Error("兼容矩阵格式无效。");
}

const passed = matrix.verified.filter((record) => record.result === "passed");
const missingCombinations = matrix.requiredPlatforms.flatMap((platform) =>
  matrix.requiredEngines
    .filter(
      (engine) =>
        !passed.some((record) => record.platform === platform && record.engine === engine),
    )
    .map((engine) => `${platform}/${engine}`),
);

for (const record of passed) {
  for (const field of [
    "engine",
    "serverVersion",
    "clientTools",
    "platform",
    "osVersion",
    "nodeVersion",
    "installAdapterVersion",
    "verifiedAt",
    "result",
  ]) {
    if (record[field] === undefined || record[field] === "") {
      throw new Error(`兼容矩阵通过记录缺少字段 ${field}。`);
    }
  }
}

const passedPlatforms = matrix.platformVerifications.filter(
  (record) => record.result === "passed",
);
const missingPlatformVerifications = [];
for (const platform of matrix.requiredPlatforms) {
  const record = passedPlatforms.find((candidate) => candidate.platform === platform);
  if (record === undefined) {
    missingPlatformVerifications.push(`${platform}:未验证`);
    continue;
  }
  for (const field of ["osVersion", "nodeVersion", "npmInstall", "verifiedAt", "result"]) {
    if (record[field] === undefined || record[field] === "") {
      throw new Error(`平台验证 ${platform} 缺少字段 ${field}。`);
    }
  }
  if (record.npmInstall !== true) {
    missingPlatformVerifications.push(`${platform}:NPM安装未通过`);
  }
  if (typeof record.agentDiscoveryVerified !== "boolean") {
    throw new Error(`平台验证 ${platform} 缺少 Agent 发现认证状态。`);
  }
  if (
    record.agentDiscoveryVerified === false &&
    (typeof record.agentDiscoveryNote !== "string" || record.agentDiscoveryNote.trim() === "")
  ) {
    throw new Error(`平台验证 ${platform} 的 Agent 发现尚未认证，必须记录原因。`);
  }
  const targets = Array.isArray(record.skillTargets) ? record.skillTargets : [];
  const missingTargets = matrix.requiredSkillTargets.filter((target) => !targets.includes(target));
  if (missingTargets.length > 0) {
    missingPlatformVerifications.push(`${platform}:缺少Skill目标(${missingTargets.join("、")})`);
  }
}

if (missingCombinations.length > 0 || missingPlatformVerifications.length > 0) {
  throw new Error(
    `发布验收尚未完成。缺少数据库组合：${missingCombinations.join(", ") || "无"}；` +
      `缺少平台与Skill验证：${missingPlatformVerifications.join(", ") || "无"}。`,
  );
}

process.stdout.write(
  `兼容矩阵发布门通过：${passed.length} 条数据库记录，${passedPlatforms.length} 条平台安装与Skill路径记录；` +
    `Agent发现认证 ${passedPlatforms.filter((record) => record.agentDiscoveryVerified === true).length}/${passedPlatforms.length}，` +
    `未认证项不得声明支持。\n`,
);
