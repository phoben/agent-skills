import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Listr } from "listr2";
import { ConnectionService } from "../connections/service.js";
import { ConfigStore } from "../config/store.js";
import { DataPullError, asDataPullError } from "../core/errors.js";
import { exporterFor } from "../exporters/factory.js";
import { commonObjectTypes, OBJECT_TYPES } from "../exporters/objects.js";
import { PullService, type PullExecutionResult } from "../pull/service.js";
import { SkillInstaller } from "../skills/installer.js";
import { AGENTS, parseSkillTarget, type AgentId, type SkillScope } from "../skills/targets.js";
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
  while (!(await validateConnectionWithRecovery(connections, connection))) {
    connection = await chooseConnection(connections);
  }
  const resolved = await connections.resolve(connection.alias);
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
  await exporter.test(await connections.resolve(connection.alias, database), database);

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
        name: `${connection.alias} · ${connection.engine}`,
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
): Promise<boolean> {
  const tools = new ToolManager();
  while (true) {
    try {
      const missing = await tools.missing(connection.engine);
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
        await tools.ensure(connection.engine, true, true);
      }
      const resolved = await service.resolve(connection.alias);
      await exporterFor(connection.engine).test(resolved);
      process.stdout.write(`连接 ${connection.alias} 校验通过。\n`);
      return true;
    } catch (error) {
      const normalized = asDataPullError(error);
      process.stderr.write(`连接校验失败 [${normalized.code}]：${normalized.message}\n`);
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
      if (action === "back") return false;
      if (action === "exit") throw new DataPullError("OPERATION_CANCELLED", "已退出向导。", 1);
      const reference = connection.authMode === "url" ? connection.urlRef : connection.credentialRef;
      if (reference === undefined) {
        process.stderr.write("该连接没有可更新的凭证引用。\n");
        continue;
      }
      const value = await password({ message: `更新 ${reference}（输入不会回显）：`, mask: "*" });
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

async function promptSkillSetup(store: ConfigStore): Promise<void> {
  const config = await store.read();
  if (config.onboarding.skillPrompted) return;
  const install = await confirm({
    message: "是否为 Agent 安装 DataPull Skill？稍后也可运行 datapull skill install。",
    default: true,
  });
  if (install) {
    const agents = await checkbox<AgentId>({
      message: "选择 Agent 工具（不检测本机是否已安装）：",
      required: true,
      choices: AGENTS.map((agent) => ({ name: agentLabel(agent), value: agent })),
    });
    const projectRoot = await discoverProjectRoot();
    const targets = [];
    for (const agent of agents) {
      const scopes = await checkbox<SkillScope>({
        message: `${agentLabel(agent)} 的安装位置：`,
        required: true,
        choices: [
          { name: "用户级", value: "user", checked: true },
          { name: "项目级", value: "project" },
        ],
      });
      for (const scope of scopes) targets.push(parseSkillTarget(`${agent}:${scope}`, projectRoot));
    }
    process.stdout.write(
      `\n将写入以下 Skill 目标：\n${targets.map((target) => `- ${target.agent}:${target.scope} → ${target.path}`).join("\n")}\n`,
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function agentLabel(agent: AgentId): string {
  return {
    codex: "Codex",
    claude: "Claude Code",
    cursor: "Cursor",
    trae: "Trae IDE",
  }[agent];
}
