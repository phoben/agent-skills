import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectionService } from "../src/connections/service.js";
import { MYSQL_PROVIDER_MANIFEST } from "../src/providers/builtin.js";
import type { DatabaseProvider } from "../src/providers/provider.js";
import { DatabaseProviderRegistry } from "../src/providers/registry.js";
import { PullService } from "../src/pull/service.js";
import type { ToolManager } from "../src/tools/manager.js";
import type { ConnectionConfig, ResolvedConnection } from "../src/types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("Provider 驱动的完整拉取接缝", () => {
  it("通过 Registry 校验范围、探测就绪并原子提交对象", async () => {
    const root = await temporaryDirectory();
    const connection = mysqlConnection();
    const resolved: ResolvedConnection = { ...connection, password: "secret", database: "app" };
    const rememberDatabase = vi.fn().mockResolvedValue(undefined);
    const connections = {
      get: vi.fn().mockResolvedValue(connection),
      resolve: vi.fn().mockResolvedValue(resolved),
      rememberDatabase,
    } as unknown as ConnectionService;
    const ensure = vi.fn().mockResolvedValue([]);
    const tools = { ensure } as unknown as ToolManager;
    const probeExportReadiness = vi.fn().mockResolvedValue({ serverVersion: "8.4" });
    const provider: DatabaseProvider = {
      manifest: MYSQL_PROVIDER_MANIFEST,
      listDatabases: vi.fn(),
      probeConnection: vi.fn(),
      probeExportReadiness,
      exportObjects: async function* () {
        yield { type: "table", name: "users", ddl: "CREATE TABLE users(id int);" };
      },
    };
    const registry = new DatabaseProviderRegistry([provider]);

    const result = await new PullService(connections, registry, tools).execute({
      connectionAlias: "main",
      database: "app",
      include: ["table"],
      installMissing: false,
      confirmed: true,
      projectRoot: root,
    });

    expect(ensure).toHaveBeenCalledWith("mysql", false, true);
    expect(probeExportReadiness).toHaveBeenCalledWith(resolved, {
      database: "app",
      objectTypes: ["table"],
    });
    expect(result.objectCounts).toEqual({ table: 1 });
    expect(result.preservedTypes).toEqual([
      "view",
      "function",
      "procedure",
      "trigger",
      "event",
    ]);
    expect(
      await readFile(
        join(root, ".database-schema", "main", "app", "table", "users.sql"),
        "utf8",
      ),
    ).toBe("CREATE TABLE users(id int);\n");
    expect(rememberDatabase).toHaveBeenCalledWith("main", "app");
  });

  it("Provider 在流式读取中失败时保留旧结构且不记录最近数据库", async () => {
    const root = await temporaryDirectory();
    const oldTable = join(
      root,
      ".database-schema",
      "main",
      "app",
      "table",
      "users.sql",
    );
    await mkdir(join(oldTable, ".."), { recursive: true });
    await writeFile(oldTable, "CREATE TABLE users(old_id int);\n", "utf8");
    const connection = mysqlConnection();
    const rememberDatabase = vi.fn();
    const connections = {
      get: vi.fn().mockResolvedValue(connection),
      resolve: vi.fn().mockResolvedValue({ ...connection, password: "secret" }),
      rememberDatabase,
    } as unknown as ConnectionService;
    const provider: DatabaseProvider = {
      manifest: MYSQL_PROVIDER_MANIFEST,
      listDatabases: vi.fn(),
      probeConnection: vi.fn(),
      probeExportReadiness: vi.fn().mockResolvedValue({ serverVersion: "8.4" }),
      exportObjects: async function* () {
        yield { type: "table", name: "users", ddl: "CREATE TABLE users(id int);" };
        throw new Error("连接中断");
      },
    };
    const registry = new DatabaseProviderRegistry([provider]);
    const tools = { ensure: vi.fn().mockResolvedValue([]) } as unknown as ToolManager;

    await expect(
      new PullService(connections, registry, tools).execute({
        connectionAlias: "main",
        database: "app",
        include: ["table"],
        installMissing: false,
        confirmed: true,
        projectRoot: root,
      }),
    ).rejects.toThrow("连接中断");

    expect(await readFile(oldTable, "utf8")).toBe("CREATE TABLE users(old_id int);\n");
    expect(rememberDatabase).not.toHaveBeenCalled();
  });
});

function mysqlConnection(): ConnectionConfig {
  return {
    alias: "main",
    engine: "mysql",
    authMode: "password",
    host: "db.local",
    port: 3306,
    username: "reader",
    credentialRef: "MAIN_PASSWORD",
    recentDatabases: [],
    favoriteDatabases: [],
  };
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "datapull-provider-pull-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
