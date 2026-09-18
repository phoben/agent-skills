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

  async resolve(alias: string, database?: string): Promise<ResolvedConnection> {
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
      return {
        ...connection,
        host: url.hostname,
        port: url.port.length > 0 ? Number(url.port) : DEFAULT_PORTS[connection.engine],
        username: decodeUrlComponent(url.username),
        password: decodeUrlComponent(url.password),
        sslMode: connection.sslMode ?? url.searchParams.get("sslmode") ?? undefined,
        secretUrl: value,
        ...(database === undefined ? {} : { database }),
      };
    }
    if (connection.authMode === "password") {
      return {
        ...connection,
        port: connection.port ?? DEFAULT_PORTS[connection.engine],
        password: await this.store.resolveSecret(required(connection.credentialRef, "credentialRef")),
        ...(database === undefined ? {} : { database }),
      };
    }
    return {
      ...connection,
      port: connection.port ?? DEFAULT_PORTS[connection.engine],
      ...(database === undefined ? {} : { database }),
    };
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
}): ConnectionConfig {
  return normalizeConnection({
    ...input,
    recentDatabases: [],
    favoriteDatabases: [],
    ...(input.engine === "sqlserver"
      ? { tls: { encrypt: true as const, trustServerCertificate: false as const } }
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
    parsed.tls = { encrypt: true, trustServerCertificate: false };
  } else delete parsed.tls;
  return parsed;
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
  };
}

export function cloneConfig(config: GlobalConfig): GlobalConfig {
  return structuredClone(config);
}
