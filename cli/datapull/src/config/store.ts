import { copyFile, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { DataPullError } from "../core/errors.js";
import type { ConnectionConfig, GlobalConfig } from "../types.js";
import { atomicWriteFile, pathExists } from "../utils/fs.js";
import { assertCredentialReference, parseDotenv, serializeDotenv } from "./dotenv.js";
import type { ConfigPaths } from "./paths.js";
import { getConfigPaths } from "./paths.js";
import { globalConfigSchema } from "./schema.js";
import { CredentialSecurity } from "./security.js";

const EMPTY_CONFIG: GlobalConfig = {
  version: 1,
  onboarding: { skillPrompted: false },
  connections: [],
};

export class ConfigStore {
  readonly paths: ConfigPaths;
  readonly security: CredentialSecurity;

  constructor(
    paths = getConfigPaths(),
    security = new CredentialSecurity(),
  ) {
    this.paths = paths;
    this.security = security;
  }

  async exists(): Promise<boolean> {
    return pathExists(this.paths.config);
  }

  async initialize(): Promise<boolean> {
    const created = !(await this.exists());
    await this.security.secureDirectory(this.paths.root);
    if (created) await this.write(EMPTY_CONFIG);
    if (!(await pathExists(this.paths.credentials))) {
      await writeFile(this.paths.credentials, "", { encoding: "utf8", mode: 0o600 });
    }
    await this.security.secureFile(this.paths.credentials);
    return created;
  }

  async read(): Promise<GlobalConfig> {
    if (!(await this.exists())) {
      throw new DataPullError(
        "CONFIG_INVALID",
        "全局配置尚未初始化，请先运行 datapull。",
        3,
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.paths.config, "utf8"));
    } catch (error) {
      throw new DataPullError(
        "CONFIG_INVALID",
        `无法读取全局配置：${this.paths.config}`,
        3,
        undefined,
        error instanceof Error ? { cause: error } : undefined,
      );
    }
    const parsed = globalConfigSchema.safeParse(raw);
    if (!parsed.success) {
      const unsupported =
        typeof raw === "object" &&
        raw !== null &&
        "version" in raw &&
        raw.version !== 1;
      throw new DataPullError(
        unsupported ? "CONFIG_VERSION_UNSUPPORTED" : "CONFIG_INVALID",
        unsupported ? "全局配置版本不受支持。" : "全局配置内容无效。",
        3,
        { issues: parsed.error.issues.map((issue) => issue.message) },
      );
    }
    return parsed.data;
  }

  async write(config: GlobalConfig): Promise<void> {
    const result = globalConfigSchema.safeParse(config);
    if (!result.success) {
      throw new DataPullError(
        "CONFIG_INVALID",
        "拒绝写入无效的全局配置。",
        3,
        { issues: result.error.issues.map((issue) => issue.message) },
      );
    }
    const parsed = result.data;
    await this.security.secureDirectory(this.paths.root);
    await atomicWriteFile(
      this.paths.config,
      `${JSON.stringify(parsed, null, 2)}\n`,
      0o600,
    );
  }

  async backupConfig(): Promise<string> {
    await this.security.secureDirectory(this.paths.backups);
    const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const target = join(this.paths.backups, `${basename(this.paths.config)}.${stamp}.bak`);
    await copyFile(this.paths.config, target);
    await this.security.secureFile(target);
    return target;
  }

  async readCredentials(): Promise<Map<string, string>> {
    await this.security.verifyFile(this.paths.credentials);
    return parseDotenv(await readFile(this.paths.credentials, "utf8"));
  }

  async setCredential(name: string, value: string): Promise<void> {
    assertCredentialReference(name);
    if (value.length === 0) {
      throw new DataPullError("CREDENTIALS_UNAVAILABLE", "凭证值不能为空。", 3);
    }
    const values = await this.readCredentials();
    values.set(name, value);
    await atomicWriteFile(this.paths.credentials, serializeDotenv(values), 0o600);
    await this.security.secureFile(this.paths.credentials);
  }

  async removeCredentialIfUnused(name: string, exceptAlias?: string): Promise<boolean> {
    const config = await this.read();
    const used = config.connections.some(
      (connection) =>
        connection.alias !== exceptAlias &&
        (connection.credentialRef === name || connection.urlRef === name),
    );
    if (used) return false;
    const values = await this.readCredentials();
    const removed = values.delete(name);
    if (removed) {
      await atomicWriteFile(this.paths.credentials, serializeDotenv(values), 0o600);
      await this.security.secureFile(this.paths.credentials);
    }
    return removed;
  }

  async resolveSecret(name: string): Promise<string> {
    assertCredentialReference(name);
    const processValue = process.env[name];
    if (processValue !== undefined && processValue.length > 0) return processValue;
    const values = await this.readCredentials();
    const value = values.get(name);
    if (value === undefined || value.length === 0) {
      throw new DataPullError(
        "CREDENTIALS_UNAVAILABLE",
        `凭证变量 ${name} 未在当前进程或 credentials.env 中提供。`,
        3,
        { reference: name, credentialsPath: this.paths.credentials },
      );
    }
    return value;
  }

  async updateConnections(
    updater: (connections: ConnectionConfig[]) => ConnectionConfig[],
  ): Promise<GlobalConfig> {
    const config = await this.read();
    const updated: GlobalConfig = { ...config, connections: updater(config.connections) };
    await this.write(updated);
    return updated;
  }
}
