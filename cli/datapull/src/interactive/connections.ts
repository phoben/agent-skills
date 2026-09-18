import { confirm, input, password, select } from "@inquirer/prompts";
import { ConnectionService, createConnection } from "../connections/service.js";
import { DataPullError } from "../core/errors.js";
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
      choices: [
        { name: "MySQL", value: "mysql" },
        { name: "PostgreSQL", value: "postgresql" },
        { name: "SQL Server", value: "sqlserver" },
      ],
    }));
  const authMode =
    initial.authMode ??
    (await select<AuthMode>({
      message: "认证方式：",
      choices: [
        { name: "用户名和密码", value: "password" },
        { name: "完整连接 URL", value: "url" },
        ...(engine === "sqlserver" && process.platform === "win32"
          ? [{ name: "Windows 集成认证", value: "integrated" as const }]
          : []),
      ],
    }));
  if (authMode === "integrated" && (engine !== "sqlserver" || process.platform !== "win32")) {
    throw new DataPullError(
      "INVALID_ARGUMENT",
      "Windows 集成认证只支持 Windows 上的 SQL Server。",
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
      const defaultPort = engine === "mysql" ? 3306 : engine === "postgresql" ? 5432 : 1433;
      const value = await input({ message: "端口：", default: String(defaultPort) });
      port = Number(value);
    }
  }
  if (authMode === "password") {
    username ??= await input({ message: "用户名：", required: true });
    credentialRef ??= await input({
      message: "密码变量名：",
      default: defaultReference(alias, "PASSWORD"),
    });
    pendingSecret = await password({ message: "数据库密码（输入不会回显）：", mask: "*" });
  } else if (authMode === "url") {
    urlRef ??= await input({
      message: "连接 URL 变量名：",
      default: defaultReference(alias, "URL"),
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
  });
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

function defaultReference(alias: string, suffix: string): string {
  const stem = alias
    .toUpperCase()
    .replace(/[^A-Z0-9_]/gu, "_")
    .replace(/^[^A-Z_]/u, "_$&");
  return `DATAPULL_${stem}_${suffix}`;
}
