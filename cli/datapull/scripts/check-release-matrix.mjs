import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "..", "resources", "compatibility-matrix.json");
const matrix = JSON.parse(await readFile(path, "utf8"));
if (matrix.version !== 1 || !Array.isArray(matrix.verified)) {
  throw new Error("兼容矩阵格式无效。");
}

const passed = matrix.verified.filter((record) => record.result === "passed");
const missingPlatforms = matrix.requiredPlatforms.filter(
  (platform) => !passed.some((record) => record.platform === platform),
);
const missingEngines = matrix.requiredEngines.filter(
  (engine) => !passed.some((record) => record.engine === engine),
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

if (missingPlatforms.length > 0 || missingEngines.length > 0) {
  throw new Error(
    `发布验收尚未完成。缺少平台：${missingPlatforms.join(", ") || "无"}；缺少数据库：${missingEngines.join(", ") || "无"}。`,
  );
}

process.stdout.write(`兼容矩阵发布门通过：${passed.length} 条真实验证记录。\n`);
