import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConnectionService, createConnection } from "../src/connections/service.js";
import { ConfigStore } from "../src/config/store.js";
import { getConfigPaths } from "../src/config/paths.js";
import type { CredentialSecurity } from "../src/config/security.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe("登记连接", () => {
  it("一个连接保存多个最近数据库和收藏", async () => {
    const service = await serviceFixture();
    await service.add(
      createConnection({
        alias: "main",
        engine: "postgresql",
        authMode: "password",
        host: "db.local",
        username: "reader",
        credentialRef: "MAIN_PASSWORD",
      }),
    );
    await service.rememberDatabase("main", "app");
    await service.rememberDatabase("main", "audit");
    await service.setFavorite("main", "app", true);
    const connection = await service.get("MAIN");
    expect(connection.recentDatabases).toEqual(["audit", "app"]);
    expect(connection.favoriteDatabases).toEqual(["app"]);
  });

  it("解析 URL 时忽略其中的数据库名并保留显式目标", async () => {
    const service = await serviceFixture();
    await service.store.setCredential("MAIN_URL", "postgresql://reader:secret@db.local:5433/ignored?sslmode=require");
    await service.add(
      createConnection({ alias: "main", engine: "postgresql", authMode: "url", urlRef: "MAIN_URL" }),
    );
    const resolved = await service.resolve("main", "actual");
    expect(resolved).toMatchObject({
      host: "db.local",
      port: 5433,
      username: "reader",
      password: "secret",
      database: "actual",
      sslMode: "require",
    });
  });

  it("SQL Server 默认验证证书并允许显式信任或单次覆盖", async () => {
    const service = await serviceFixture();
    await service.add(
      createConnection({
        alias: "sqlserver-main",
        engine: "sqlserver",
        authMode: "password",
        host: "db.local",
        username: "reader",
        credentialRef: "MAIN_PASSWORD",
        trustServerCertificate: true,
      }),
    );

    expect((await service.get("sqlserver-main")).tls).toEqual({
      encrypt: true,
      trustServerCertificate: true,
    });
    expect(
      (await service.resolve("sqlserver-main", undefined, {
        trustServerCertificate: false,
      })).tls,
    ).toEqual({ encrypt: true, trustServerCertificate: false });

    const updated = await service.update("sqlserver-main", {
      tls: { encrypt: true, trustServerCertificate: false },
    });
    expect(updated.tls?.trustServerCertificate).toBe(false);
  });
});

async function serviceFixture(): Promise<ConnectionService> {
  const root = await mkdtemp(join(tmpdir(), "datapull-connection-test-"));
  directories.push(root);
  const security = {
    secureDirectory: async () => undefined,
    secureFile: async () => undefined,
    verifyFile: async () => undefined,
  } as unknown as CredentialSecurity;
  const store = new ConfigStore(getConfigPaths("linux", { DATAPULL_CONFIG_HOME: root }), security);
  await store.initialize();
  await store.setCredential("MAIN_PASSWORD", "secret");
  return new ConnectionService(store);
}
