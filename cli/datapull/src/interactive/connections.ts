import { confirm, input, password, select } from "@inquirer/prompts";
import {
  ConnectionService,
  createConnection,
  defaultPasswordCredentialRef,
} from "../connections/service.js";
import { DataPullError, asDataPullError } from "../core/errors.js";
import { databaseProviders } from "../providers/builtin.js";
import { ToolManager } from "../tools/manager.js";
import type { AuthMode, ConnectionConfig, Engine } from "../types.js";

export interface ConnectionInput {
  alias?: string | undefined;
  engine?: Engine | undefined;
  authMode?: AuthMode | undefined;
  host?: string | undefined;
  port?: number | undefined;
  username?: string | undefined;
  credentialRef?: string | undefined;
  urlRef?: string | undefined;
  sslMode?: string | undefined;
  trustServerCertificate?: boolean | undefined;
}

export async function promptAndAddConnection(
  service: ConnectionService,
  initial: ConnectionInput = {},
): Promise<ConnectionConfig> {
  const alias = initial.alias ?? (await input({ message: "连接别名：", required: true }));
  if (
    (await service.list()).some(
      (connection) =>
        connection.alias.toLocaleLowerCase("en-US") === alias.toLocaleLowerCase("en-US"),
    )
  ) {
    throw new DataPullError(
      "CONNECTION_ALIAS_CONFLICT",
      `连接别名已存在：${alias}`,
      2,
    );
  }
  const engine =
    initial.engine ??
    (await select<Engine>({
      message: "数据库类型：",
      choices: databaseProviders.list().map((provider) => ({
        name: provider.manifest.displayName,
        value: provider.manifest.id,
      })),
    }));
  const provider = databaseProviders.get(engine);
  const authMode =
    initial.authMode ??
    (await select<AuthMode>({
      message: "认证方式：",
      choices: [
        ...provider.manifest.authModes.flatMap((mode) => {
          if (mode === "integrated" && process.platform !== "win32") return [];
          return [{
            name:
              mode === "password"
                ? "用户名和密码"
                : mode === "url"
                  ? "完整连接 URL"
                  : "Windows 集成认证",
            value: mode,
          }];
        }),
      ] as { name: string; value: AuthMode }[],
    }));
  if (
    !provider.manifest.authModes.includes(authMode) ||
    (authMode === "integrated" && process.platform !== "win32")
  ) {
    throw new DataPullError(
      "INVALID_ARGUMENT",
      `${provider.manifest.displayName} 不支持当前环境中的 ${authMode} 认证。`,
      2,
    );
  }

  let host = initial.host;
  let port = initial.port;
  let username = initial.username;
  let credentialRef = initial.credentialRef;
  let urlRef = initial.urlRef;
  let pendingSecret: string | undefined;
  if (authMode !== "url") {
    host ??= await input({ message: "数据库主机：", required: true });
    if (port === undefined) {
      const defaultPort = provider.manifest.defaultPort;
      const value = await input({ message: "端口：", default: String(defaultPort) });
      port = Number(value);
    }
  }
  if (authMode === "password") {
    username ??= await input({ message: "用户名：", required: true });
    credentialRef ??= defaultPasswordCredentialRef(alias, await service.list());
    pendingSecret = await password({ message: "数据库密码（输入不会回显）：", mask: "*" });
  } else if (authMode === "url") {
    urlRef ??= await input({
      message: "连接 URL 变量名：",
      default: defaultUrlReference(alias),
    });
    pendingSecret = await password({ message: "完整连接 URL（输入不会回显）：", mask: "*" });
  }

  const connection = createConnection({
    alias,
    engine,
    authMode,
    ...(host === undefined ? {} : { host }),
    ...(port === undefined ? {} : { port }),
    ...(username === undefined ? {} : { username }),
    ...(credentialRef === undefined ? {} : { credentialRef }),
    ...(urlRef === undefined ? {} : { urlRef }),
    ...(initial.sslMode === undefined ? {} : { sslMode: initial.sslMode }),
    ...(initial.trustServerCertificate === undefined
      ? {}
      : { trustServerCertificate: initial.trustServerCertificate }),
  });
  if (connection.tls?.trustServerCertificate === true) {
    process.stderr.write(
      "警告：该连接将保持加密，但不会验证 SQL Server 的身份，可能受到中间人攻击。\n",
    );
  }
  const approved = await confirm({
    message: `确认登记连接 ${connection.alias}（${connection.engine} / ${connection.authMode}）？`,
    default: true,
  });
  if (!approved) throw new DataPullError("OPERATION_CANCELLED", "已取消登记连接。", 1);
  const reference = authMode === "url" ? urlRef : credentialRef;
  if (pendingSecret !== undefined && reference !== undefined) {
    await service.store.setCredential(reference, pendingSecret);
  }
  return service.add(connection);
}

export interface ValidatedConnection {
  connection: ConnectionConfig;
  trustServerCertificateOnce: boolean;
}

interface ValidateConnectionOptions {
  allowBack?: boolean;
}

export async function validateConnectionWithRecovery(
  service: ConnectionService,
  connection: ConnectionConfig,
  options: ValidateConnectionOptions = {},
): Promise<ValidatedConnection | undefined> {
  const tools = new ToolManager();
  const allowBack = options.allowBack !== false;
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
      await databaseProviders.get(current.engine).probeConnection(resolved);
      process.stdout.write(`连接 ${current.alias} 校验通过。\n`);
      return { connection: current, trustServerCertificateOnce };
    } catch (error) {
      const normalized = asDataPullError(error);
      process.stderr.write(`连接校验失败 [${normalized.code}]：${normalized.message}\n`);
      if (
        databaseProviders.get(current.engine).manifest.tls.trustServerCertificate &&
        normalized.code === "SQLSERVER_TLS_CERTIFICATE_UNTRUSTED"
      ) {
        const tlsAction = await select<"once" | "save" | "back" | "exit">({
          message:
            "服务器证书不受信任。信任后连接仍加密，但无法验证服务器身份，可能受到中间人攻击：",
          choices: [
            { name: "仅本次信任并继续", value: "once" },
            { name: "保存到该连接并继续", value: "save" },
            ...(allowBack ? [{ name: "返回连接选择", value: "back" as const }] : []),
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
        throw new DataPullError("OPERATION_CANCELLED", "已退出连接校验。", 1);
      }
      const action = await select<"retry" | "credential" | "back" | "exit">({
        message: "请选择恢复操作：",
        choices: [
          { name: "重试", value: "retry" },
          { name: "更新凭证", value: "credential" },
          ...(allowBack ? [{ name: "返回连接选择", value: "back" as const }] : []),
          { name: "退出", value: "exit" },
        ],
      });
      if (action === "retry") continue;
      if (action === "back") return undefined;
      if (action === "exit") {
        throw new DataPullError("OPERATION_CANCELLED", "已退出连接校验。", 1);
      }
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

function defaultUrlReference(alias: string): string {
  const stem = alias
    .toUpperCase()
    .replace(/[^A-Z0-9_]/gu, "_")
    .replace(/^[^A-Z_]/u, "_$&");
  return `DATAPULL_${stem}_URL`;
}
