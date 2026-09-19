import { createHash } from "node:crypto";
import { DataPullError } from "../core/errors.js";
import type {
  ConnectionConfig,
  Engine,
  GlobalConfig,
  ResolvedConnection,
} from "../types.js";
import { validatePathSegment } from "../utils/path.js";
import { ConfigStore } from "../config/store.js";

const DEFAULT_PORTS: Record<Engine, number> = {
  mysql: 3306,
  postgresql: 5432,
  sqlserver: 1433,
};

/**
 * 密码认证的凭证引用由连接别名确定，避免交互流程要求用户了解本地凭证文件结构。
 * 已登记连接始终保留其原有引用，因而刷新凭证不会随 CLI 升级或别名大小写变化而漂移。
 */
export function defaultPasswordCredentialRef(
  alias: string,
  existingConnections: readonly Pick<ConnectionConfig, "credentialRef">[] = [],
): string {
  const stem = alias
    .toUpperCase()
    .replace(/[^A-Z0-9_]/gu, "_")
    .replace(/^[^A-Z_]/u, "_$&");
  const base = `DATAPULL_${stem}_PASSWORD`;
  const occupied = new Set(
    existingConnections.flatMap((connection) =>
      connection.credentialRef === undefined ? [] : [connection.credentialRef],
    ),
  );
  if (!occupied.has(base)) return base;

  // 不同别名可能被规范化为同一个环境变量名（例如 foo-bar 与 foo_bar）。
  // 仅在发生冲突时附加别名哈希，既避免覆盖其他连接的秘密，又不改变常见别名的可读引用。
  const digest = createHash("sha256")
    .update(alias.toLocaleLowerCase("en-US"))
    .digest("hex")
    .toUpperCase();
  for (const length of [8, 12, 16, 24, 64]) {
    const candidate = `DATAPULL_${stem}_${digest.slice(0, length)}_PASSWORD`;
    if (!occupied.has(candidate)) return candidate;
  }
  throw new DataPullError(
    "CONNECTION_CREDENTIAL_REF_CONFLICT",
    `无法为连接别名生成唯一密码变量名：${alias}`,
    2,
  );
}

export const SQLSERVER_TRUST_WARNING =
  "连接保持加密，但不会验证 SQL Server 身份，可能受到中间人攻击。";

export interface ResolveConnectionOptions {
  trustServerCertificate?: boolean | undefined;
}

export class ConnectionService {
  constructor(readonly store: ConfigStore) {}

  async list(): Promise<ConnectionConfig[]> {
    return (await this.store.read()).connections;
  }

  async get(alias: string): Promise<ConnectionConfig> {
    const connection = (await this.list()).find(
      (item) => item.alias.toLocaleLowerCase("en-US") === alias.toLocaleLowerCase("en-US"),
    );
    if (connection === undefined) {
      throw new DataPullError(
        "CONNECTION_NOT_FOUND",
        `未找到登记连接：${alias}`,
        3,
        { connectionAlias: alias },
      );
    }
    return connection;
  }

  async add(connection: ConnectionConfig): Promise<ConnectionConfig> {
    validatePathSegment(connection.alias, "连接别名");
    await this.store.updateConnections((connections) => {
      if (
        connections.some(
          (item) =>
            item.alias.toLocaleLowerCase("en-US") ===
            connection.alias.toLocaleLowerCase("en-US"),
        )
      ) {
        throw new DataPullError(
          "CONNECTION_ALIAS_CONFLICT",
          `连接别名已存在：${connection.alias}`,
          2,
        );
      }
      return [...connections, connection];
    });
    return connection;
  }

  async update(
    alias: string,
    changes: Partial<Omit<ConnectionConfig, "alias">>,
  ): Promise<ConnectionConfig> {
    let updated: ConnectionConfig | undefined;
    await this.store.updateConnections((connections) =>
      connections.map((connection) => {
        if (connection.alias.toLocaleLowerCase("en-US") !== alias.toLocaleLowerCase("en-US")) {
          return connection;
        }
        updated = normalizeConnection({ ...connection, ...changes, alias: connection.alias });
        return updated;
      }),
    );
    if (updated === undefined) {
      throw new DataPullError("CONNECTION_NOT_FOUND", `未找到登记连接：${alias}`, 3);
    }
    return updated;
  }

  async remove(alias: string): Promise<ConnectionConfig> {
    const current = await this.get(alias);
    await this.store.updateConnections((connections) =>
      connections.filter(
        (connection) =>
          connection.alias.toLocaleLowerCase("en-US") !== alias.toLocaleLowerCase("en-US"),
      ),
    );
    return current;
  }

  async setFavorite(alias: string, database: string, favorite: boolean): Promise<void> {
    validatePathSegment(database, "数据库名");
    const connection = await this.get(alias);
    const values = new Set(connection.favoriteDatabases);
    if (favorite) values.add(database);
    else values.delete(database);
    await this.update(alias, { favoriteDatabases: [...values] });
  }

  async rememberDatabase(alias: string, database: string): Promise<void> {
    validatePathSegment(database, "数据库名");
    const connection = await this.get(alias);
    const recent = [database, ...connection.recentDatabases.filter((item) => item !== database)].slice(
      0,
      10,
    );
    let updated: ConnectionConfig | undefined;
    await this.store.updateConnections((connections) =>
      connections.map((item) => {
        if (item.alias !== connection.alias) return item;
        updated = { ...item, recentDatabases: recent };
        return updated;
      }),
    );
    if (updated === undefined) {
      throw new DataPullError("CONNECTION_NOT_FOUND", `未找到登记连接：${alias}`, 3);
    }
  }

  async resolve(
    alias: string,
    database?: string,
    options: ResolveConnectionOptions = {},
  ): Promise<ResolvedConnection> {
    const connection = await this.get(alias);
    if (connection.authMode === "integrated" && process.platform !== "win32") {
      throw new DataPullError(
        "CONFIG_INVALID",
        "Windows 集成认证只支持 Windows 上的 SQL Server。",
        3,
      );
    }
    if (connection.authMode === "url") {
      const value = await this.store.resolveSecret(required(connection.urlRef, "urlRef"));
      const url = parseConnectionUrl(connection.engine, value);
      return applyResolveOptions({
        ...connection,
        host: url.hostname,
        port: url.port.length > 0 ? Number(url.port) : DEFAULT_PORTS[connection.engine],
        username: decodeUrlComponent(url.username),
        password: decodeUrlComponent(url.password),
        sslMode: connection.sslMode ?? url.searchParams.get("sslmode") ?? undefined,
        secretUrl: value,
        ...(database === undefined ? {} : { database }),
      }, options);
    }
    if (connection.authMode === "password") {
      return applyResolveOptions({
        ...connection,
        port: connection.port ?? DEFAULT_PORTS[connection.engine],
        password: await this.store.resolveSecret(required(connection.credentialRef, "credentialRef")),
        ...(database === undefined ? {} : { database }),
      }, options);
    }
    return applyResolveOptions({
      ...connection,
      port: connection.port ?? DEFAULT_PORTS[connection.engine],
      ...(database === undefined ? {} : { database }),
    }, options);
  }
}

export function createConnection(input: {
  alias: string;
  engine: Engine;
  authMode: "password" | "url" | "integrated";
  host?: string | undefined;
  port?: number | undefined;
  username?: string | undefined;
  credentialRef?: string | undefined;
  urlRef?: string | undefined;
  sslMode?: string | undefined;
  trustServerCertificate?: boolean | undefined;
}): ConnectionConfig {
  const { trustServerCertificate, ...connectionInput } = input;
  return normalizeConnection({
    ...connectionInput,
    recentDatabases: [],
    favoriteDatabases: [],
    ...(connectionInput.engine === "sqlserver"
      ? {
          tls: {
            encrypt: true as const,
            trustServerCertificate: trustServerCertificate ?? false,
          },
        }
      : {}),
  });
}

function normalizeConnection(connection: ConnectionConfig): ConnectionConfig {
  const parsed = structuredClone(connection);
  if (parsed.authMode === "url") {
    delete parsed.host;
    delete parsed.port;
    delete parsed.username;
    delete parsed.credentialRef;
  } else {
    delete parsed.urlRef;
  }
  if (parsed.authMode === "integrated") {
    delete parsed.username;
    delete parsed.credentialRef;
  }
  if (parsed.engine === "sqlserver") {
    parsed.tls = {
      encrypt: true,
      trustServerCertificate: parsed.tls?.trustServerCertificate ?? false,
    };
  } else delete parsed.tls;
  return parsed;
}

function applyResolveOptions(
  connection: ResolvedConnection,
  options: ResolveConnectionOptions,
): ResolvedConnection {
  if (options.trustServerCertificate === undefined) {
    return connection;
  }
  if (connection.engine !== "sqlserver") {
    throw new DataPullError(
      "INVALID_ARGUMENT",
      "信任服务器证书只适用于 SQL Server。",
      2,
    );
  }
  return {
    ...connection,
    tls: {
      encrypt: true,
      trustServerCertificate: options.trustServerCertificate,
    },
  };
}

function parseConnectionUrl(engine: Engine, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new DataPullError(
      "CONFIG_INVALID",
      "完整连接 URL 无法解析。",
      3,
      undefined,
      error instanceof Error ? { cause: error } : undefined,
    );
  }
  const allowed: Record<Engine, string[]> = {
    mysql: ["mysql:"],
    postgresql: ["postgres:", "postgresql:"],
    sqlserver: ["sqlserver:", "mssql:"],
  };
  if (!allowed[engine].includes(url.protocol) || url.hostname.length === 0) {
    throw new DataPullError("CONFIG_INVALID", `连接 URL 与 ${engine} 不匹配。`, 3);
  }
  return url;
}

function required(value: string | undefined, field: string): string {
  if (value !== undefined) return value;
  throw new DataPullError("CONFIG_INVALID", `连接缺少 ${field}。`, 3);
}

function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    throw new DataPullError(
      "CONFIG_INVALID",
      "连接 URL 包含无效的百分号编码。",
      3,
      undefined,
      error instanceof Error ? { cause: error } : undefined,
    );
  }
}

export function redactedConnection(connection: ConnectionConfig): Record<string, unknown> {
  return {
    ...connection,
    credentialRef: connection.credentialRef,
    urlRef: connection.urlRef,
    ...(connectionSecurityWarnings(connection).length === 0
      ? {}
      : { securityWarnings: connectionSecurityWarnings(connection) }),
  };
}

export function connectionSecurityWarnings(
  connection: Pick<ConnectionConfig, "engine" | "tls">,
): string[] {
  return connection.engine === "sqlserver" &&
    connection.tls?.trustServerCertificate === true
    ? [SQLSERVER_TRUST_WARNING]
    : [];
}

export function cloneConfig(config: GlobalConfig): GlobalConfig {
  return structuredClone(config);
}
