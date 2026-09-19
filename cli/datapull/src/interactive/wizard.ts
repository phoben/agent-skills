import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Listr } from "listr2";
import { ConnectionService } from "../connections/service.js";
import { ConfigStore } from "../config/store.js";
import { DataPullError, asDataPullError } from "../core/errors.js";
import { exporterFor } from "../exporters/factory.js";
import { commonObjectTypes, OBJECT_TYPES } from "../exporters/objects.js";
import { PullService, type PullExecutionResult } from "../pull/service.js";
import { SkillInstaller } from "../skills/installer.js";
import {
  getAgentDefinition,
  listAgentDefinitions,
  type AgentId,
} from "../skills/agents.js";
import {
  parseSkillTarget,
  uniqueSkillTargets,
  type SkillScope,
  type SkillTarget,
} from "../skills/targets.js";
import { ToolManager } from "../tools/manager.js";
import type { ConnectionConfig } from "../types.js";
import { discoverProjectRoot, validatePathSegment } from "../utils/path.js";
import { promptAndAddConnection } from "./connections.js";

export async function runWizard(store: ConfigStore): Promise<PullExecutionResult> {
  const created = !(await store.exists());
  if (created) {
    process.stdout.write(`DataPull 将创建用户级配置：${store.paths.root}\n`);
    const approved = await confirm({ message: "继续初始化？", default: true });
    if (!approved) throw new DataPullError("OPERATION_CANCELLED", "已取消初始化。", 1);
  }
  await store.initialize();
  const connections = new ConnectionService(store);
  await promptSkillSetup(store);

  let connection = await chooseConnection(connections);
  let trustServerCertificateOnce = false;
  while (true) {
    const validation = await validateConnectionWithRecovery(connections, connection);
    if (validation !== undefined) {
      connection = validation.connection;
      trustServerCertificateOnce = validation.trustServerCertificateOnce;
      break;
    }
    connection = await chooseConnection(connections);
  }
  const resolved = await connections.resolve(connection.alias, undefined, {
    ...(trustServerCertificateOnce ? { trustServerCertificate: true } : {}),
  });
  const exporter = exporterFor(connection.engine);
  let enumerated: string[] = [];
  try {
    enumerated = await exporter.listDatabases(resolved);
  } catch (error) {
    const normalized = asDataPullError(error);
    process.stderr.write(`无法枚举数据库 [${normalized.code}]，仍可手工输入。\n`);
  }
  const database = await chooseDatabase(connection, enumerated);
  validatePathSegment(database, "数据库名");
  await exporter.test(
    await connections.resolve(connection.alias, database, {
      ...(trustServerCertificateOnce ? { trustServerCertificate: true } : {}),
    }),
    database,
  );

  const common = new Set(commonObjectTypes(connection.engine));
  const selectedTypes = await checkbox<string>({
    message: "选择要获取的数据库对象（默认全选）：",
    required: true,
    choices: OBJECT_TYPES[connection.engine].map((type) => ({
      name: `${common.has(type) ? "常用" : "高级"} · ${type}`,
      value: type,
      checked: true,
    })),
  });
  const projectRoot = await discoverProjectRoot();
  process.stdout.write(
    [
      "\n本次操作：",
      `  连接：${connection.alias}`,
      `  数据库：${database}`,
      `  对象类型：${selectedTypes.join("、")}`,
      `  项目根：${projectRoot}`,
      ...(connection.tls?.trustServerCertificate === true || trustServerCertificateOnce
        ? ["  SQL Server TLS：连接已加密，但不验证服务器身份"]
        : []),
      "  覆盖规则：所选类型整体更新；未选类型保留；任一所选类型失败则均不更新。",
    ].join("\n") + "\n",
  );
  const approved = await confirm({ message: "开始获取结构文件？", default: true });
  if (!approved) throw new DataPullError("OPERATION_CANCELLED", "已取消结构文件拉取。", 1);

  const pull = new PullService(connections);
  let result: PullExecutionResult | undefined;
  const tasks = new Listr(
    [
      {
        title: "获取数据库结构文件",
        task: async (_context, task) => {
          result = await pull.execute({
            connectionAlias: connection.alias,
            database,
            include: selectedTypes,
            installMissing: true,
            confirmed: true,
            trustServerCertificate: trustServerCertificateOnce,
            projectRoot,
            onStage: (stage) => {
              task.output = stage;
            },
          });
        },
      },
    ],
    { concurrent: false },
  );
  await tasks.run();
  if (result === undefined) {
    throw new DataPullError("UNEXPECTED_ERROR", "拉取任务未返回结果。", 1);
  }
  const finalResult = result as PullExecutionResult;
  process.stdout.write(
    `\n获取成功：${Object.values(finalResult.objectCounts).reduce((sum, count) => sum + count, 0)} 个对象\n` +
      `输出目录：${finalResult.outputPath}\n` +
      `已更新：${finalResult.updatedTypes.join("、")}\n` +
      `已保留：${finalResult.preservedTypes.join("、") || "无"}\n`,
  );
  return finalResult;
}

async function chooseConnection(service: ConnectionService): Promise<ConnectionConfig> {
  const connections = await service.list();
  const value = await select<string>({
    message: "选择登记连接：",
    choices: [
      ...connections.map((connection) => ({
        name: `${connection.alias} · ${connection.engine}${connection.tls?.trustServerCertificate === true ? " · ⚠ 未验证服务器身份" : ""}`,
        value: connection.alias,
      })),
      { name: "＋ 添加新数据库连接", value: "__add__" },
    ],
  });
  return value === "__add__" ? promptAndAddConnection(service) : service.get(value);
}

async function validateConnectionWithRecovery(
  service: ConnectionService,
  connection: ConnectionConfig,
): Promise<
  | {
      connection: ConnectionConfig;
      trustServerCertificateOnce: boolean;
    }
  | undefined
> {
  const tools = new ToolManager();
  let current = connection;
  let trustServerCertificateOnce = false;
  while (true) {
    try {
      const missing = await tools.missing(current.engine);
      if (missing.length > 0) {
        const plans = tools.plans(missing);
        process.stdout.write("\n检测到缺少数据库工具：\n");
        for (const plan of plans) {
          process.stdout.write(
            `- ${plan.tool}\n  来源：${plan.source}\n  官方说明：${plan.sourceUrl}\n  命令：${plan.command} ${plan.args.join(" ")}\n  权限：${plan.permission}\n  影响：${plan.downloadImpact}\n`,
          );
        }
        const install = await confirm({ message: "确认自动安装以上工具？", default: false });
        if (!install) {
          throw new DataPullError(
            "DATABASE_TOOL_MISSING",
            "缺少数据库工具，请按以上命令手工安装后重试。",
            4,
          );
        }
        await tools.ensure(current.engine, true, true);
      }
      const resolved = await service.resolve(current.alias, undefined, {
        ...(trustServerCertificateOnce ? { trustServerCertificate: true } : {}),
      });
      await exporterFor(current.engine).test(resolved);
      process.stdout.write(`连接 ${current.alias} 校验通过。\n`);
      return { connection: current, trustServerCertificateOnce };
    } catch (error) {
      const normalized = asDataPullError(error);
      process.stderr.write(`连接校验失败 [${normalized.code}]：${normalized.message}\n`);
      if (
        current.engine === "sqlserver" &&
        normalized.code === "SQLSERVER_TLS_CERTIFICATE_UNTRUSTED"
      ) {
        const tlsAction = await select<"once" | "save" | "back" | "exit">({
          message:
            "服务器证书不受信任。信任后连接仍加密，但无法验证服务器身份，可能受到中间人攻击：",
          choices: [
            { name: "仅本次信任并继续", value: "once" },
            { name: "保存到该连接并继续", value: "save" },
            { name: "返回连接选择", value: "back" },
            { name: "退出", value: "exit" },
          ],
        });
        if (tlsAction === "once") {
          trustServerCertificateOnce = true;
          continue;
        }
        if (tlsAction === "save") {
          const approved = await confirm({
            message: "确认保存该风险设置？可稍后使用 connection update 恢复证书验证。",
            default: false,
          });
          if (!approved) continue;
          current = await service.update(current.alias, {
            tls: { encrypt: true, trustServerCertificate: true },
          });
          trustServerCertificateOnce = false;
          continue;
        }
        if (tlsAction === "back") return undefined;
        throw new DataPullError("OPERATION_CANCELLED", "已退出向导。", 1);
      }
      const action = await select<"retry" | "credential" | "back" | "exit">({
        message: "请选择恢复操作：",
        choices: [
          { name: "重试", value: "retry" },
          { name: "更新凭证", value: "credential" },
          { name: "返回连接选择", value: "back" },
          { name: "退出", value: "exit" },
        ],
      });
      if (action === "retry") continue;
      if (action === "back") return undefined;
      if (action === "exit") throw new DataPullError("OPERATION_CANCELLED", "已退出向导。", 1);
      const reference = current.authMode === "url" ? current.urlRef : current.credentialRef;
      if (reference === undefined) {
        process.stderr.write("该连接没有可更新的凭证引用。\n");
        continue;
      }
      const value = await password({
        message:
          current.authMode === "url"
            ? "更新完整连接 URL（输入不会回显）："
            : "更新数据库密码（输入不会回显）：",
        mask: "*",
      });
      await service.store.setCredential(reference, value);
    }
  }
}

async function chooseDatabase(
  connection: ConnectionConfig,
  enumerated: string[],
): Promise<string> {
  const values = unique([
    ...connection.favoriteDatabases,
    ...connection.recentDatabases,
    ...enumerated,
  ]);
  const manual = "__manual__";
  const chosen = await select<string>({
    message: "选择目标数据库：",
    choices: [
      ...values.map((database) => ({
        name: `${connection.favoriteDatabases.includes(database) ? "★ " : ""}${database}`,
        value: database,
      })),
      { name: "手工输入数据库名", value: manual },
    ],
  });
  return chosen === manual
    ? input({ message: "目标数据库名：", required: true })
    : chosen;
}

interface SkillSetupOptions {
  projectRoot?: string;
}

export async function promptSkillSetup(
  store: ConfigStore,
  options: SkillSetupOptions = {},
): Promise<void> {
  const config = await store.read();
  if (config.onboarding.skillPrompted) return;
  const install = await confirm({
    message: "是否为 Agent 安装 DataPull Skill？稍后也可运行 datapull skill install。",
    default: true,
  });
  if (install) {
    const projectRoot = options.projectRoot ?? (await discoverProjectRoot());
    const targets = await chooseSkillTargets(projectRoot);
    process.stdout.write(
      `\n将写入 ${targets.length} 个 Skill 目录：\n${targets.map((target) => `- ${targetLabel(target)} → ${target.path}`).join("\n")}\n`,
    );
    if (await confirm({ message: "确认创建以上目录并安装 Skill？", default: true })) {
      const installer = new SkillInstaller();
      for (const target of targets) {
        const status = await installer.status(target);
        if (status.status === "missing") await installer.install(target, true);
        else process.stdout.write(`跳过已有目标：${target.path}（${status.status}）\n`);
      }
    }
  }
  await store.write({ ...config, onboarding: { skillPrompted: true } });
}

async function chooseSkillTargets(
  projectRoot: string,
): Promise<SkillTarget[]> {
  const selectedAgents = await checkbox<AgentId>({
    message: "选择 Agent 工具（不检测本机是否已安装）：",
    required: true,
    choices: listAgentDefinitions().map((agent) => ({
      name: agent.displayName,
      value: agent.id,
      checked: agent.id === "codex",
    })),
  });
  const targets: SkillTarget[] = [];
  for (const agent of selectedAgents) {
    const definition = getAgentDefinition(agent);
    const scope = await select<SkillScope>({
      message: `${definition.displayName} 的安装位置：`,
      choices: [
        ...(definition.supportsUserScope
          ? [{ name: "用户级 · 所有项目可用", value: "user" as const }]
          : []),
        { name: "项目级 · 仅当前项目", value: "project" as const },
      ],
      default: definition.supportsUserScope ? "user" : "project",
    });
    targets.push(parseSkillTarget(`${agent}:${scope}`, projectRoot));
  }
  return uniqueSkillTargets(targets);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function agentLabel(agent: AgentId): string {
  return getAgentDefinition(agent).displayName;
}

function targetLabel(target: SkillTarget): string {
  if (target.agent === "universal" && target.scope === "project") {
    return "兼容共享目录（.agents/skills）";
  }
  return `${agentLabel(target.agent)}（${target.agent}:${target.scope}）`;
}
