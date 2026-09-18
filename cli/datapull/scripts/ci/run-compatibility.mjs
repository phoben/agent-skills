import { spawnSync } from "node:child_process";
import { readFile, readdir, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..", "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const evidenceDirectory = resolve(
  process.env.DATAPULL_CI_EVIDENCE_DIR ?? join(packageRoot, "ci-evidence"),
);
const platform = required("DATAPULL_CI_PLATFORM");
const installMissing = process.env.DATAPULL_CI_INSTALL_MISSING === "true";
const temporaryRoot = await mkdtemp(join(tmpdir(), "datapull-compatibility-"));
const configRoot = join(temporaryRoot, "config");
const installRoot = join(temporaryRoot, "install");
const packRoot = join(temporaryRoot, "pack");
const npmUserConfig = join(temporaryRoot, "npmrc");
const secretValues = [
  required("DATAPULL_CI_MYSQL_PASSWORD"),
  required("DATAPULL_CI_POSTGRESQL_PASSWORD"),
  required("DATAPULL_CI_SQLSERVER_PASSWORD"),
];

const engines = [
  {
    id: "mysql",
    alias: `ci-${platform}-mysql`,
    host: required("DATAPULL_CI_MYSQL_HOST"),
    port: optional("DATAPULL_CI_MYSQL_PORT", "3306"),
    username: required("DATAPULL_CI_MYSQL_USERNAME"),
    passwordReference: "DATAPULL_CI_MYSQL_PASSWORD",
    database: required("DATAPULL_CI_MYSQL_DATABASE"),
    sslMode: optional("DATAPULL_CI_MYSQL_SSL_MODE", "REQUIRED"),
    include: ["table", "view", "function", "procedure", "trigger", "event"],
  },
  {
    id: "postgresql",
    alias: `ci-${platform}-postgresql`,
    host: required("DATAPULL_CI_POSTGRESQL_HOST"),
    port: optional("DATAPULL_CI_POSTGRESQL_PORT", "5432"),
    username: required("DATAPULL_CI_POSTGRESQL_USERNAME"),
    passwordReference: "DATAPULL_CI_POSTGRESQL_PASSWORD",
    database: required("DATAPULL_CI_POSTGRESQL_DATABASE"),
    sslMode: optional("DATAPULL_CI_POSTGRESQL_SSL_MODE", "verify-full"),
    include: [
      "schema",
      "extension",
      "table",
      "view",
      "materialized_view",
      "sequence",
      "function",
      "procedure",
      "trigger",
      "type",
    ],
  },
  {
    id: "sqlserver",
    alias: `ci-${platform}-sqlserver`,
    host: required("DATAPULL_CI_SQLSERVER_HOST"),
    port: optional("DATAPULL_CI_SQLSERVER_PORT", "1433"),
    username: required("DATAPULL_CI_SQLSERVER_USERNAME"),
    passwordReference: "DATAPULL_CI_SQLSERVER_PASSWORD",
    database: required("DATAPULL_CI_SQLSERVER_DATABASE"),
    include: [
      "schema",
      "table",
      "view",
      "function",
      "procedure",
      "trigger",
      "sequence",
      "synonym",
      "type",
    ],
  },
];

try {
  const cliPath = await installPackedCli();
  const cliEnvironment = {
    ...process.env,
    DATAPULL_CONFIG_HOME: configRoot,
    NO_COLOR: "1",
  };
  const databaseRecords = [];

  for (const engine of engines) {
    runCli(
      cliPath,
      [
        "connection",
        "add",
        "--alias",
        engine.alias,
        "--engine",
        engine.id,
        "--auth-mode",
        "password",
        "--host",
        engine.host,
        "--port",
        engine.port,
        "--username",
        engine.username,
        "--credential-ref",
        engine.passwordReference,
        ...(engine.sslMode === undefined ? [] : ["--ssl-mode", engine.sslMode]),
        ...(engine.id === "sqlserver" ? ["--trust-server-certificate"] : []),
        "--yes",
        "--json",
      ],
      cliEnvironment,
    );

    const pull = runCli(
      cliPath,
      [
        "pull",
        "--connection",
        engine.alias,
        "--database",
        engine.database,
        "--include",
        engine.include.join(","),
        ...(installMissing ? ["--install-missing"] : []),
        "--yes",
        "--json",
      ],
      cliEnvironment,
    );
    for (const type of engine.include) {
      if (Number(pull.objectCounts?.[type] ?? 0) < 1) {
        throw new Error(`${engine.id} 验收库缺少对象类型 ${type}。`);
      }
    }
    await validateOutput(String(pull.outputPath));

    const connectionTest = runCli(
      cliPath,
      [
        "connection",
        "test",
        "--alias",
        engine.alias,
        "--database",
        engine.database,
        "--json",
      ],
      cliEnvironment,
    );
    const doctor = runCli(cliPath, ["doctor", "--json"], cliEnvironment);
    const toolCheck = doctor.checks?.find((check) => check.name === `tools:${engine.id}`);
    if (toolCheck?.ok !== true) throw new Error(`${engine.id} 客户端工具诊断未通过。`);

    databaseRecords.push({
      engine: engine.id,
      serverVersion: connectionTest.serverVersion,
      clientTools: toolCheck.detail,
      platform,
      osVersion: `${process.platform} ${process.arch} ${process.env.ImageOS ?? "self-hosted"}`,
      nodeVersion: process.version,
      installAdapterVersion: 1,
      verifiedAt: new Date().toISOString(),
      result: "passed",
      gitSha: process.env.GITHUB_SHA ?? "local",
    });
  }

  const targets = [
    "codex:user",
    "codex:project",
    "claude:user",
    "claude:project",
    "cursor:user",
    "cursor:project",
    "trae:user",
    "trae:project",
  ];
  runCli(
    cliPath,
    ["skill", "sync", ...targets.flatMap((target) => ["--target", target]), "--force", "--yes", "--json"],
    cliEnvironment,
  );
  const skillStatus = runCli(cliPath, ["skill", "status", "--json"], cliEnvironment);
  const currentTargets = skillStatus.targets
    ?.filter((target) => target.status === "current")
    .map((target) => `${target.agent}:${target.scope}`);
  const missingTargets = targets.filter((target) => !currentTargets?.includes(target));
  if (missingTargets.length > 0) {
    throw new Error(`Skill 安装回验缺少目标：${missingTargets.join("、")}`);
  }

  const packageVersion = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version;
  const evidence = {
    version: 1,
    packageVersion,
    databaseRecords,
    platformVerification: {
      platform,
      osVersion: `${process.platform} ${process.arch} ${process.env.ImageOS ?? "self-hosted"}`,
      nodeVersion: process.version,
      npmInstall: true,
      skillTargets: targets,
      agentDiscoveryVerified: false,
      agentDiscoveryNote: "CI 只验证安装路径与回验；Codex、Claude Code、Cursor、Trae 实际发现仍需专用验收机确认。",
      verifiedAt: new Date().toISOString(),
      result: "passed",
      gitSha: process.env.GITHUB_SHA ?? "local",
    },
  };
  await mkdir(evidenceDirectory, { recursive: true });
  const evidencePath = join(evidenceDirectory, `${platform}.json`);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`兼容性证据已生成：${evidencePath}\n`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function installPackedCli() {
  await mkdir(packRoot, { recursive: true });
  await writeFile(npmUserConfig, "registry=https://registry.npmjs.org\n", "utf8");
  const npmEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toLowerCase().startsWith("npm_config_")),
  );
  npmEnvironment.NPM_CONFIG_USERCONFIG = npmUserConfig;
  npmEnvironment.NPM_CONFIG_REGISTRY = "https://registry.npmjs.org";
  npmEnvironment.NPM_CONFIG_IGNORE_SCRIPTS = "true";
  const packed = runNpm(
    ["pack", "--ignore-scripts", "--json", "--pack-destination", packRoot],
    npmEnvironment,
    packageRoot,
  );
  const packageResult = JSON.parse(packed.stdout);
  const packedEntry = Array.isArray(packageResult)
    ? packageResult[0]
    : packageResult["@yg-toolkit/datapull"] ?? Object.values(packageResult)[0];
  const filename = packedEntry?.filename;
  if (typeof filename !== "string") throw new Error("npm pack 未返回包文件名。");
  await mkdir(installRoot, { recursive: true });
  runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", installRoot, join(packRoot, filename)],
    npmEnvironment,
    packageRoot,
  );
  const cliPath = join(
    installRoot,
    "node_modules",
    "@yg-toolkit",
    "datapull",
    "dist",
    "index.js",
  );
  const version = run(process.execPath, [cliPath, "--version"], process.env, repositoryRoot).stdout.trim();
  if (version.length === 0) throw new Error("安装包入口未返回版本号。");
  return cliPath;
}

function runCli(cliPath, args, environment) {
  const result = run(process.execPath, [cliPath, ...args], environment, repositoryRoot);
  try {
    const payload = JSON.parse(result.stdout);
    if (payload.ok !== true) throw new Error(payload.error?.message ?? "DataPull 命令失败。");
    return payload;
  } catch (error) {
    throw new Error(`DataPull JSON 输出无效：${redact(result.stdout)}。`, { cause: error });
  }
}

function runNpm(args, environment, cwd) {
  const npmEntry = process.env.npm_execpath;
  if (npmEntry === undefined || npmEntry.length === 0) {
    throw new Error("请通过 npm run ci:compatibility 启动兼容性验收。");
  }
  return run(process.execPath, [npmEntry, ...args], environment, cwd);
}

function run(command, args, environment, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = [result.error?.message, result.stderr, result.stdout]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n");
    throw new Error(
      redact(
        `${command} 执行失败（${result.status ?? "no-exit"}）：` +
          `${detail.length === 0 ? "无输出" : detail}`,
      ),
    );
  }
  return result;
}

async function validateOutput(directory) {
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".sql")) files.push(path);
    }
  };
  await visit(directory);
  if (files.length === 0) throw new Error(`结构文件目录为空：${directory}`);
  const forbidden = /\b(?:GRANT|REVOKE)\b|\bOWNER\s+TO\b|\bDEFINER\s*=/iu;
  const sentinel = "DATAPULL_BUSINESS_DATA_MUST_NOT_APPEAR";
  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (forbidden.test(content) || content.includes(sentinel)) {
      throw new Error(`结构文件包含禁止内容：${file}`);
    }
    for (const secret of secretValues) {
      if (content.includes(secret)) throw new Error(`结构文件包含数据库秘密：${file}`);
    }
  }
}

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`缺少 CI 环境变量 ${name}。`);
  return value;
}

function optional(name, fallback) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function redact(value) {
  return secretValues.reduce(
    (current, secret) => current.split(secret).join("***"),
    String(value),
  );
}
