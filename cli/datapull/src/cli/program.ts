import { confirm, password } from "@inquirer/prompts";
import { Command, Option } from "commander";
import { createRequire } from "node:module";
import {
  ConnectionService,
  connectionSecurityWarnings,
  createConnection,
  defaultPasswordCredentialRef,
  redactedConnection,
} from "../connections/service.js";
import { ConfigStore } from "../config/store.js";
import { DataPullError } from "../core/errors.js";
import { Output } from "../core/output.js";
import { runDoctor } from "../doctor/service.js";
import { exporterFor } from "../exporters/factory.js";
import {
  promptAndAddConnection,
  validateConnectionWithRecovery,
  type ConnectionInput,
} from "../interactive/connections.js";
import { promptImmediatePull } from "../interactive/pull.js";
import { runWizard } from "../interactive/wizard.js";
import { PullService } from "../pull/service.js";
import { SkillInstaller } from "../skills/installer.js";
import {
  allSkillTargets,
  parseSkillTarget,
  uniqueSkillTargets,
} from "../skills/targets.js";
import type { AuthMode, ConnectionConfig, Engine } from "../types.js";
import { discoverProjectRoot, validatePathSegment } from "../utils/path.js";
import { ToolManager } from "../tools/manager.js";

interface GlobalOptions {
  json?: boolean;
  yes?: boolean;
  color?: boolean;
}

const packageJson = createRequire(import.meta.url)("../../package.json") as {
  version: string;
};

const ROOT_HELP = `
快速开始：
  datapull
  datapull connection add
  npx --yes --package=@yg-toolkit/datapull@latest datapull connection add

常用示例：
  datapull connection list
  datapull pull --connection demo-mysql --database shop_demo --yes
  datapull pull --connection demo-mysql --database shop_demo --include table,view --yes --json
  datapull pull --help

说明：
  DataPull 只读取数据库元数据并生成 DDL 结构文件，不导出业务数据。
  交互式 connection add 会登记并校验连接，成功后可立即输入数据库名拉取。
  完整向导会按全部、常用、高级、自定义四类询问对象范围，默认选择常用对象。
  密码和完整连接 URL 不应放入命令参数。`;

const CONNECTION_HELP = `
新手入口：
  datapull connection add

该交互流程会隐藏输入秘密、保存连接、检查数据库工具并校验连通性；
校验成功后可以立即输入目标数据库名，拉取全部支持的结构对象。`;

const CONNECTION_ADD_HELP = `
交互示例：
  datapull connection add
  npx --yes --package=@yg-toolkit/datapull@latest datapull connection add

模拟信息：
  连接别名          demo-mysql
  数据库类型        MySQL
  主机              mysql.demo.example
  端口              3306
  用户名            schema_reader
  目标数据库        shop_demo

自动化示例（预先在环境中设置 DATAPULL_DEMO_MYSQL_PASSWORD）：
  datapull connection add --alias demo-mysql --engine mysql --auth-mode password --host mysql.demo.example --port 3306 --username schema_reader --yes --json

非交互模式只登记连接；不会追加校验、提问或自动拉取。`;

const PULL_HELP = `
示例：
  datapull pull --connection demo-mysql --database shop_demo --yes
  datapull pull --connection demo-mysql --database shop_demo --include table,view --yes
  datapull pull --connection demo-mysql --database shop_demo --yes --json

省略 --include 时拉取当前数据库引擎支持的全部对象类型。
结构文件写入当前项目的 .database-schema/<连接别名>/<数据库名>/。`;

interface ConnectionOptions extends GlobalOptions, ConnectionInput {
  refreshCredential?: boolean;
  deleteCredential?: boolean;
  database?: string;
  verifyServerCertificate?: boolean;
}

export function buildProgram(store = new ConfigStore()): Command {
  const program = new Command();
  program
    .name("datapull")
    .description("只读拉取 MySQL、PostgreSQL 与 SQL Server 的 DDL 结构文件")
    .version(packageJson.version, "-V, --version", "显示当前版本")
    .helpOption("-h, --help", "显示命令帮助")
    .option("--json", "仅在结束时向 stdout 输出一个 JSON 文档；进度写入 stderr")
    .option("--yes", "确认当前命令声明的写入或安装操作；不跳过安全校验")
    .option("--no-color", "禁用 ANSI 色彩")
    .showHelpAfterError()
    .exitOverride()
    .addHelpText("after", ROOT_HELP);

  program.action(async (_options, command) => {
    const global = globals(command);
    if (!process.stdin.isTTY || !process.stdout.isTTY || global.json === true) {
      throw new DataPullError(
        "INTERACTIVE_TTY_REQUIRED",
        "无参数 datapull 需要交互式终端；自动化场景请使用子命令和 --json。",
        2,
      );
    }
    await runWizard(store);
  });

  registerConnectionCommands(program, store);
  registerDatabaseCommands(program, store);
  registerPullCommand(program, store);
  registerSkillCommands(program);
  registerConfigCommands(program, store);
  registerDoctorCommand(program, store);
  return program;
}

function registerConnectionCommands(program: Command, store: ConfigStore): void {
  const connection = program
    .command("connection")
    .description("管理用户级数据库连接与凭证引用")
    .addHelpText("after", CONNECTION_HELP);
  connection
    .command("add")
    .description("交互式登记并校验连接，成功后可立即拉取")
    .option("--alias <alias>", "连接别名")
    .addOption(new Option("--engine <engine>", "数据库类型").choices(["mysql", "postgresql", "sqlserver"]))
    .addOption(new Option("--auth-mode <mode>", "认证方式").choices(["password", "url", "integrated"]))
    .option("--host <host>", "数据库主机")
    .option("--port <port>", "端口", numberParser)
    .option("--username <username>", "用户名")
    .option("--credential-ref <name>", "密码变量名（省略时按连接别名自动生成；兼容已有脚本）")
    .option("--url-ref <name>", "连接 URL 变量名")
    .option("--ssl-mode <mode>", "MySQL/PostgreSQL TLS 模式")
    .option(
      "--trust-server-certificate",
      "保持加密但不验证 SQL Server 身份；仅用于明确接受风险的连接",
    )
    .addHelpText("after", CONNECTION_ADD_HELP)
    .action(async (options: ConnectionOptions, command: Command) => {
      const global = globals(command);
      await initializeForWrite(store, global.yes === true);
      const service = new ConnectionService(store);
      let created;
      if (process.stdin.isTTY && global.json !== true) {
        created = await promptAndAddConnection(service, options);
        process.stdout.write(`连接 ${created.alias} 已登记，正在校验。\n`);
        const validation = await validateConnectionWithRecovery(service, created, {
          allowBack: false,
        });
        if (validation === undefined) {
          throw new DataPullError("UNEXPECTED_ERROR", "新增连接校验未返回结果。", 1);
        }
        created = validation.connection;
        await promptImmediatePull(service, created, {
          trustServerCertificateOnce: validation.trustServerCertificateOnce,
        });
      } else {
        requireYes(global);
        const requiredOptions = requireConnectionCreateOptions(options, await service.list());
        if (requiredOptions.authMode === "integrated" && process.platform !== "win32") {
          throw new DataPullError(
            "INVALID_ARGUMENT",
            "Windows 集成认证只支持 Windows。",
            2,
          );
        }
        const secretReference =
          requiredOptions.authMode === "url"
            ? requiredOptions.urlRef
            : requiredOptions.authMode === "password"
              ? requiredOptions.credentialRef
              : undefined;
        if (secretReference !== undefined) await store.resolveSecret(secretReference);
        created = await service.add(createConnection(requiredOptions));
      }
      output(command, "connection add").success(
        redactedConnection(created),
        successMessage(`已登记连接：${created.alias}`, created),
      );
    });

  connection
    .command("list")
    .description("列出脱敏连接")
    .action(async (_options, command) => {
      const service = new ConnectionService(store);
      const registered = await service.list();
      const connections = registered.map(redactedConnection);
      output(command, "connection list").success(
        { connections },
        connections.length === 0
          ? "尚未登记数据库连接。"
          : registered
              .map(
                (item) =>
                  `${item.alias} · ${item.engine}${connectionSecurityWarnings(item).length > 0 ? " · ⚠ 未验证服务器身份" : ""}`,
              )
              .join("\n"),
      );
    });

  connection
    .command("show")
    .description("查看单个脱敏连接")
    .requiredOption("--alias <alias>", "连接别名")
    .action(async (options: ConnectionOptions, command) => {
      const item = await new ConnectionService(store).get(requiredString(options.alias, "--alias"));
      output(command, "connection show").success(redactedConnection(item), JSON.stringify(redactedConnection(item), null, 2));
    });

  connection
    .command("update")
    .description("更新连接或凭证引用")
    .requiredOption("--alias <alias>", "连接别名")
    .addOption(new Option("--engine <engine>").choices(["mysql", "postgresql", "sqlserver"]))
    .addOption(new Option("--auth-mode <mode>").choices(["password", "url", "integrated"]))
    .option("--host <host>")
    .option("--port <port>", "端口", numberParser)
    .option("--username <username>")
    .option("--credential-ref <name>")
    .option("--url-ref <name>")
    .option("--ssl-mode <mode>")
    .addOption(
      new Option(
        "--trust-server-certificate",
        "保持加密但不验证 SQL Server 身份",
      ).conflicts("verifyServerCertificate"),
    )
    .addOption(
      new Option(
        "--verify-server-certificate",
        "恢复严格验证 SQL Server 证书",
      ).conflicts("trustServerCertificate"),
    )
    .option("--refresh-credential", "在交互终端隐藏输入新凭证")
    .action(async (options: ConnectionOptions, command) => {
      const global = globals(command);
      await requireWriteConfirmation(
        global,
        options.trustServerCertificate === true
          ? "确认保存“信任服务器证书”？连接仍加密，但 SQL Server 身份不再验证。"
          : "确认更新该登记连接？",
      );
      const service = new ConnectionService(store);
      const alias = requiredString(options.alias, "--alias");
      const existing = await service.get(alias);
      if (options.refreshCredential === true) {
        if (!process.stdin.isTTY || global.json === true) {
          throw new DataPullError(
            "INTERACTIVE_TTY_REQUIRED",
            "更新凭证值需要交互式隐藏输入；非交互模式只能切换凭证引用。",
            2,
          );
        }
        const reference = existing.authMode === "url" ? existing.urlRef : existing.credentialRef;
        if (reference === undefined) {
          throw new DataPullError("INVALID_ARGUMENT", "当前连接没有可刷新的凭证引用。", 2);
        }
        await store.setCredential(
          reference,
          await password({
            message:
              existing.authMode === "url"
                ? "输入新的完整连接 URL（输入不会回显）："
                : "输入新数据库密码（输入不会回显）：",
            mask: "*",
          }),
        );
      }
      const changes = compactConnectionChanges(options, existing);
      if (Object.keys(changes).length === 0 && options.refreshCredential !== true) {
        throw new DataPullError("INVALID_ARGUMENT", "至少提供一个待修改选项。", 2);
      }
      for (const reference of [changes.credentialRef, changes.urlRef]) {
        if (reference !== undefined) await store.resolveSecret(reference);
      }
      const updated = Object.keys(changes).length === 0 ? existing : await service.update(alias, changes);
      output(command, "connection update").success(
        redactedConnection(updated),
        successMessage(`已更新连接：${alias}`, updated),
      );
    });

  connection
    .command("remove")
    .description("删除登记连接，不删除项目结构文件")
    .requiredOption("--alias <alias>", "连接别名")
    .option("--delete-credential", "同时删除没有被其他连接引用的凭证变量")
    .action(async (options: ConnectionOptions, command) => {
      const global = globals(command);
      await requireWriteConfirmation(global, "确认删除登记连接？项目结构文件将保留。");
      const service = new ConnectionService(store);
      const removed = await service.remove(requiredString(options.alias, "--alias"));
      let credentialRemoved = false;
      if (options.deleteCredential === true) {
        const reference = removed.authMode === "url" ? removed.urlRef : removed.credentialRef;
        if (reference !== undefined) credentialRemoved = await store.removeCredentialIfUnused(reference);
      }
      output(command, "connection remove").success(
        { connectionAlias: removed.alias, removed: true, credentialRemoved },
        `已删除登记连接：${removed.alias}；项目结构文件未删除。`,
      );
    });

  connection
    .command("test")
    .description("只读校验连接或目标数据库")
    .requiredOption("--alias <alias>", "连接别名")
    .option("--database <database>", "目标数据库")
    .option(
      "--trust-server-certificate",
      "仅本次保持加密但不验证 SQL Server 身份",
    )
    .action(async (options: ConnectionOptions, command) => {
      const service = new ConnectionService(store);
      const alias = requiredString(options.alias, "--alias");
      const configured = await service.get(alias);
      if (options.trustServerCertificate === true && configured.engine !== "sqlserver") {
        throw new DataPullError(
          "INVALID_ARGUMENT",
          "--trust-server-certificate 只适用于 SQL Server。",
          2,
        );
      }
      if (options.trustServerCertificate === true) {
        await requireRiskConfirmation(globals(command));
      }
      if (options.database !== undefined) validatePathSegment(options.database, "数据库名");
      const connection = await service.resolve(alias, options.database, {
        ...(options.trustServerCertificate === true
          ? { trustServerCertificate: true }
          : {}),
      });
      await new ToolManager().ensure(connection.engine, false, false);
      const testResult = await exporterFor(connection.engine).test(connection, options.database);
      output(command, "connection test").success(
        {
          connectionAlias: alias,
          database: options.database ?? null,
          reachable: true,
          serverVersion: testResult.serverVersion,
          ...(connectionSecurityWarnings(connection).length === 0
            ? {}
            : { securityWarnings: connectionSecurityWarnings(connection) }),
        },
        successMessage(
          `连接校验通过：${alias}${options.database === undefined ? "" : ` / ${options.database}`}`,
          connection,
        ),
      );
    });
}

function registerDatabaseCommands(program: Command, store: ConfigStore): void {
  const database = program.command("database").description("查看和收藏目标数据库");
  database
    .command("list")
    .requiredOption("--connection <alias>", "连接别名")
    .option(
      "--trust-server-certificate",
      "仅本次保持加密但不验证 SQL Server 身份",
    )
    .action(async (options: { connection: string; trustServerCertificate?: boolean }, command) => {
      const service = new ConnectionService(store);
      const connection = await service.get(options.connection);
      if (options.trustServerCertificate === true && connection.engine !== "sqlserver") {
        throw new DataPullError(
          "INVALID_ARGUMENT",
          "--trust-server-certificate 只适用于 SQL Server。",
          2,
        );
      }
      if (options.trustServerCertificate === true) {
        await requireRiskConfirmation(globals(command));
      }
      const effectiveConnection =
        options.trustServerCertificate === true
          ? {
              ...connection,
              tls: { encrypt: true as const, trustServerCertificate: true },
            }
          : connection;
      let enumerated: string[] = [];
      let enumerationError: Record<string, string> | undefined;
      try {
        enumerated = await exporterFor(connection.engine).listDatabases(
          await service.resolve(connection.alias, undefined, {
            ...(options.trustServerCertificate === true
              ? { trustServerCertificate: true }
              : {}),
          }),
        );
      } catch (error) {
        const normalized = error instanceof DataPullError ? error : new DataPullError("DATABASE_CLIENT_FAILED", String(error), 1);
        enumerationError = { code: normalized.code, message: normalized.message };
      }
      const values = [...new Set([...connection.favoriteDatabases, ...connection.recentDatabases, ...enumerated])];
      output(command, "database list").success(
        {
          connectionAlias: connection.alias,
          databases: values.map((name) => ({
            name,
            favorite: connection.favoriteDatabases.includes(name),
            recent: connection.recentDatabases.includes(name),
            enumerated: enumerated.includes(name),
          })),
          manualInputAllowed: true,
          ...(connectionSecurityWarnings(effectiveConnection).length > 0
            ? { securityWarnings: connectionSecurityWarnings(effectiveConnection) }
            : {}),
          ...(enumerationError === undefined ? {} : { enumerationError }),
        },
        successMessage(
          values.length > 0
            ? values.join("\n")
            : "未枚举到数据库，可在拉取时手工指定名称。",
          effectiveConnection,
        ),
      );
    });

  const favorite = database.command("favorite").description("维护数据库收藏");
  for (const action of ["add", "remove"] as const) {
    favorite
      .command(action)
      .requiredOption("--connection <alias>", "连接别名")
      .requiredOption("--database <database>", "目标数据库")
      .action(async (options: { connection: string; database: string }, command) => {
        await requireWriteConfirmation(globals(command), `确认${action === "add" ? "收藏" : "取消收藏"}该数据库？`);
        await new ConnectionService(store).setFavorite(
          options.connection,
          options.database,
          action === "add",
        );
        output(command, `database favorite ${action}`).success(
          { connectionAlias: options.connection, database: options.database, favorite: action === "add" },
          action === "add" ? "已收藏数据库。" : "已取消收藏。",
        );
      });
  }
}

function registerPullCommand(program: Command, store: ConfigStore): void {
  program
    .command("pull")
    .description("使用已登记连接拉取指定数据库的 DDL 结构文件")
    .requiredOption("--connection <alias>", "已登记的连接别名")
    .requiredOption("--database <database>", "目标数据库名")
    .option("--include <types>", "逗号分隔的对象类型；省略时拉取当前引擎全部类型")
    .option("--install-missing", "安装缺少的官方数据库工具")
    .option(
      "--trust-server-certificate",
      "仅本次保持加密但不验证 SQL Server 身份",
    )
    .addHelpText("after", PULL_HELP)
    .action(async (options: { connection: string; database: string; include?: string; installMissing?: boolean; trustServerCertificate?: boolean }, command) => {
      const global = globals(command);
      if (global.yes !== true && options.installMissing === true) {
        const connection = await new ConnectionService(store).get(options.connection);
        const tools = new ToolManager();
        const missing = await tools.missing(connection.engine);
        if (missing.length > 0) {
          throw new DataPullError(
            "CONFIRMATION_REQUIRED",
            "自动安装数据库工具需要显式确认。",
            2,
            { actionPlan: { installation: tools.plans(missing) }, manualRequired: missing.filter((tool) => !tools.plans(missing).some((plan) => plan.tool === tool)) },
          );
        }
      }
      requireYes(global);
      const result = await new PullService(new ConnectionService(store)).execute({
        connectionAlias: options.connection,
        database: options.database,
        include: options.include?.split(",").map((value) => value.trim()).filter(Boolean),
        installMissing: options.installMissing === true,
        confirmed: global.yes === true,
        trustServerCertificate: options.trustServerCertificate === true,
        onStage: (stage) => {
          if (global.json === true) process.stderr.write(`${stage}\n`);
          else process.stdout.write(`• ${stage}\n`);
        },
      });
      output(command, "pull").success(
        result,
        [
          `结构文件已写入：${result.outputPath}`,
          ...(result.warnings ?? []).map((warning) => `警告：${warning}`),
        ].join("\n"),
      );
    });
}

function registerSkillCommands(program: Command): void {
  const skill = program.command("skill").description("安装和同步 DataPull Skill");
  skill.command("list").action(async (_options, command) => {
    const projectRoot = await discoverProjectRoot();
    const targets = allSkillTargets(projectRoot);
    output(command, "skill list").success(
      { targets },
      targets.map((target) => `${target.agent}:${target.scope} → ${target.path}`).join("\n"),
    );
  });
  skill
    .command("status")
    .option("--target <target>", "目标 agent:scope，可重复", collect, [])
    .action(async (options: { target: string[] }, command) => {
      const projectRoot = await discoverProjectRoot();
      const targets = uniqueSkillTargets(
        options.target.length === 0
          ? allSkillTargets(projectRoot)
          : options.target.map((target) => parseTarget(target, projectRoot)),
      );
      const installer = new SkillInstaller();
      const statuses = await Promise.all(targets.map(async (target) => installer.status(target)));
      output(command, "skill status").success(
        { targets: statuses },
        statuses.map((item) => `${item.agent}:${item.scope} · ${item.status} · ${item.path}`).join("\n"),
      );
    });
  skill
    .command("install")
    .option("--target <target>", "目标 agent:scope，可重复", collect, [])
    .action(async (options: { target: string[] }, command) => {
      if (options.target.length === 0) throw new DataPullError("INVALID_ARGUMENT", "至少提供一个 --target。", 2);
      await requireWriteConfirmation(globals(command), "确认创建目录并安装所选 DataPull Skill？");
      const projectRoot = await discoverProjectRoot();
      const installer = new SkillInstaller();
      const targets = [];
      const requestedTargets = uniqueSkillTargets(
        options.target.map((value) => parseTarget(value, projectRoot)),
      );
      for (const target of requestedTargets) {
        try {
          targets.push(await installer.install(target, true));
        } catch (error) {
          targets.push({
            agent: target.agent,
            scope: target.scope,
            path: target.path,
            status: "failed",
            modified: false,
            action: "none",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (targets.some((target) => target.status === "failed")) {
        throw new DataPullError("SKILL_PARTIAL_FAILURE", "部分 Skill 目标安装失败。", 1, { targets });
      }
      output(command, "skill install").success({ targets }, "DataPull Skill 安装完成。\n" + targets.map((item) => item.path).join("\n"));
    });
  skill
    .command("sync")
    .option("--target <target>", "目标 agent:scope，可重复", collect, [])
    .option("--force", "备份后覆盖用户修改")
    .action(async (options: { target: string[]; force?: boolean }, command) => {
      if (options.target.length === 0) throw new DataPullError("INVALID_ARGUMENT", "skill sync 必须明确提供 --target。", 2);
      const global = globals(command);
      if (options.force === true && global.yes !== true) {
        throw new DataPullError(
          "CONFIRMATION_REQUIRED",
          "覆盖用户修改必须同时提供明确目标、--force 和 --yes。",
          2,
        );
      }
      await requireWriteConfirmation(global, "确认同步所选 DataPull Skill？");
      const projectRoot = await discoverProjectRoot();
      const installer = new SkillInstaller();
      const targets = [];
      const requestedTargets = uniqueSkillTargets(
        options.target.map((value) => parseTarget(value, projectRoot)),
      );
      for (const target of requestedTargets) {
        try {
          targets.push(await installer.sync(target, true, options.force === true));
        } catch (error) {
          targets.push({
            agent: target.agent,
            scope: target.scope,
            path: target.path,
            status: "failed",
            modified: false,
            action: "none",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (targets.some((target) => target.status === "failed")) {
        throw new DataPullError("SKILL_PARTIAL_FAILURE", "部分 Skill 目标同步失败。", 1, { targets });
      }
      output(command, "skill sync").success({ targets }, targets.map((item) => `${item.path} · ${item.status}`).join("\n"));
    });
}

function registerConfigCommands(program: Command, store: ConfigStore): void {
  const config = program.command("config").description("查看和校验用户级配置");
  config.command("path").action((_options, command) => {
    output(command, "config path").success(
      { configRoot: store.paths.root, configPath: store.paths.config, credentialsPath: store.paths.credentials },
      `配置：${store.paths.config}\n凭证：${store.paths.credentials}`,
    );
  });
  config.command("validate").action(async (_options, command) => {
    const parsed = await store.read();
    await store.readCredentials();
    output(command, "config validate").success(
      { valid: true, version: parsed.version, connectionCount: parsed.connections.length },
      `配置有效：${parsed.connections.length} 个登记连接。`,
    );
  });
}

function registerDoctorCommand(program: Command, store: ConfigStore): void {
  program.command("doctor").description("诊断运行环境，不自动安装").action(async (_options, command) => {
    const checks = await runDoctor(store);
    output(command, "doctor").success(
      { healthy: checks.every((check) => check.ok), checks },
      checks.map((check) => `${check.ok ? "✓" : "✗"} ${check.name}：${check.detail}`).join("\n"),
    );
  });
}

function globals(command: Command): GlobalOptions {
  return command.optsWithGlobals<GlobalOptions>();
}

function output(command: Command, name: string): Output {
  return new Output({ command: name, json: globals(command).json === true });
}

async function initializeForWrite(store: ConfigStore, confirmed: boolean): Promise<void> {
  if (await store.exists()) {
    await store.initialize();
    return;
  }
  if (!confirmed && !process.stdin.isTTY) {
    throw new DataPullError("CONFIRMATION_REQUIRED", "初始化用户级配置需要 --yes。", 2, {
      configRoot: store.paths.root,
    });
  }
  if (!confirmed) {
    process.stdout.write(`将创建用户级配置：${store.paths.root}\n`);
    if (!(await confirm({ message: "确认初始化？", default: true }))) {
      throw new DataPullError("OPERATION_CANCELLED", "已取消初始化。", 1);
    }
  }
  await store.initialize();
}

async function requireWriteConfirmation(global: GlobalOptions, message: string): Promise<void> {
  if (global.yes === true) return;
  if (!process.stdin.isTTY || global.json === true) {
    throw new DataPullError("CONFIRMATION_REQUIRED", `${message} 非交互模式请添加 --yes。`, 2);
  }
  if (!(await confirm({ message, default: false }))) {
    throw new DataPullError("OPERATION_CANCELLED", "操作已取消。", 1);
  }
}

function requireYes(global: GlobalOptions): void {
  if (global.yes !== true) {
    throw new DataPullError(
      "CONFIRMATION_REQUIRED",
      "命令模式拉取会写入项目目录，请添加 --yes。",
      2,
    );
  }
}

function requireConnectionCreateOptions(
  options: ConnectionOptions,
  existingConnections: readonly Pick<ConnectionConfig, "credentialRef">[] = [],
): {
  alias: string;
  engine: Engine;
  authMode: AuthMode;
  host?: string | undefined;
  port?: number | undefined;
  username?: string | undefined;
  credentialRef?: string | undefined;
  urlRef?: string | undefined;
  sslMode?: string | undefined;
  trustServerCertificate?: boolean | undefined;
} {
  const alias = requiredString(options.alias, "--alias");
  const engine = requiredString(options.engine, "--engine") as Engine;
  const authMode = requiredString(options.authMode, "--auth-mode") as AuthMode;
  if (authMode === "password") {
    requiredString(options.host, "--host");
    requiredString(options.username, "--username");
  } else if (authMode === "url") requiredString(options.urlRef, "--url-ref");
  else requiredString(options.host, "--host");
  if (options.trustServerCertificate === true && engine !== "sqlserver") {
    throw new DataPullError(
      "INVALID_ARGUMENT",
      "--trust-server-certificate 只适用于 SQL Server。",
      2,
    );
  }
  return {
    alias,
    engine,
    authMode,
    ...(options.host === undefined ? {} : { host: options.host }),
    ...(options.port === undefined ? {} : { port: options.port }),
    ...(options.username === undefined ? {} : { username: options.username }),
    ...(authMode === "password"
      ? { credentialRef: options.credentialRef ?? defaultPasswordCredentialRef(alias, existingConnections) }
      : options.credentialRef === undefined
        ? {}
        : { credentialRef: options.credentialRef }),
    ...(options.urlRef === undefined ? {} : { urlRef: options.urlRef }),
    ...(options.sslMode === undefined ? {} : { sslMode: options.sslMode }),
    ...(options.trustServerCertificate === undefined
      ? {}
      : { trustServerCertificate: options.trustServerCertificate }),
  };
}

function compactConnectionChanges(
  options: ConnectionOptions,
  existing: ConnectionConfig,
): Partial<Omit<ConnectionConfig, "alias">> {
  const fields = ["engine", "authMode", "host", "port", "username", "credentialRef", "urlRef", "sslMode"] as const;
  const changes = Object.fromEntries(
    fields.flatMap((field) => (options[field] === undefined ? [] : [[field, options[field]]])),
  ) as Partial<Omit<ConnectionConfig, "alias">>;
  const targetEngine = options.engine ?? existing.engine;
  if (
    (options.trustServerCertificate === true || options.verifyServerCertificate === true) &&
    targetEngine !== "sqlserver"
  ) {
    throw new DataPullError(
      "INVALID_ARGUMENT",
      "服务器证书信任选项只适用于 SQL Server。",
      2,
    );
  }
  if (options.trustServerCertificate === true) {
    changes.tls = { encrypt: true, trustServerCertificate: true };
  } else if (options.verifyServerCertificate === true) {
    changes.tls = { encrypt: true, trustServerCertificate: false };
  }
  return changes;
}

async function requireRiskConfirmation(global: GlobalOptions): Promise<void> {
  if (global.yes === true) return;
  const message =
    "信任服务器证书会保留加密，但不验证 SQL Server 身份，可能受到中间人攻击。";
  if (!process.stdin.isTTY || global.json === true) {
    throw new DataPullError(
      "CONFIRMATION_REQUIRED",
      `${message} 如确认仅本次使用，请添加 --yes。`,
      2,
    );
  }
  if (!(await confirm({ message: `${message} 是否继续？`, default: false }))) {
    throw new DataPullError("OPERATION_CANCELLED", "操作已取消。", 1);
  }
}

function requiredString(value: string | undefined, option: string): string {
  if (value !== undefined && value.trim().length > 0) return value.trim();
  throw new DataPullError("INVALID_ARGUMENT", `缺少必需选项 ${option}。`, 2);
}

function successMessage(
  message: string,
  connection: Pick<ConnectionConfig, "engine" | "tls">,
): string {
  return [
    message,
    ...connectionSecurityWarnings(connection).map((warning) => `警告：${warning}`),
  ].join("\n");
}

function numberParser(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new DataPullError("INVALID_ARGUMENT", `端口无效：${value}`, 2);
  }
  return parsed;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseTarget(value: string, projectRoot: string) {
  try {
    return parseSkillTarget(value, projectRoot);
  } catch (error) {
    throw new DataPullError(
      "INVALID_ARGUMENT",
      error instanceof Error ? error.message : String(error),
      2,
    );
  }
}
