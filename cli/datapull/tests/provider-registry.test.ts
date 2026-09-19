import { describe, expect, it, vi } from "vitest";
import { DataPullError } from "../src/core/errors.js";
import {
  databaseProviders,
  MYSQL_PROVIDER_MANIFEST,
  POSTGRESQL_PROVIDER_MANIFEST,
} from "../src/providers/builtin.js";
import type { DatabaseProvider } from "../src/providers/provider.js";
import { DatabaseProviderRegistry } from "../src/providers/registry.js";

describe("数据库 Provider Registry", () => {
  it("集中登记三种内置数据库及其完整能力", () => {
    expect(databaseProviders.ids()).toEqual(["mysql", "postgresql", "sqlserver"]);
    for (const provider of databaseProviders.list()) {
      expect(provider.manifest.defaultPort).toBeGreaterThan(0);
      expect(provider.manifest.urlProtocols.length).toBeGreaterThan(0);
      expect(provider.manifest.authModes.length).toBeGreaterThan(0);
      expect(provider.manifest.objects.length).toBeGreaterThan(0);
      expect(provider.manifest.tools.length).toBeGreaterThan(0);
      expect(
        provider.manifest.objects
          .filter((object) => object.defaultSelected)
          .map((object) => object.id),
      ).toEqual(["table", "view", "function"]);
    }
  });

  it("可以使用兼容别名查找 Provider", () => {
    expect(databaseProviders.get("postgres").manifest.id).toBe("postgresql");
    expect(databaseProviders.get("mssql").manifest.id).toBe("sqlserver");
  });

  it("启动时拒绝重复 ID、别名和对象类型", () => {
    expect(
      () => new DatabaseProviderRegistry([
        fakeProvider(MYSQL_PROVIDER_MANIFEST),
        fakeProvider(MYSQL_PROVIDER_MANIFEST),
      ]),
    ).toThrowError(DataPullError);

    expect(
      () => new DatabaseProviderRegistry([
        fakeProvider({
          ...POSTGRESQL_PROVIDER_MANIFEST,
          objects: [
            POSTGRESQL_PROVIDER_MANIFEST.objects[0],
            POSTGRESQL_PROVIDER_MANIFEST.objects[0],
          ],
        }),
      ]),
    ).toThrowError(/对象类型重复/u);
  });

  it("未知 Provider 返回稳定的配置错误", () => {
    expect(() => databaseProviders.get("oracle")).toThrowError(
      expect.objectContaining({ code: "DATABASE_PROVIDER_NOT_FOUND", exitCode: 3 }),
    );
  });
});

function fakeProvider(
  manifest: DatabaseProvider["manifest"],
): DatabaseProvider {
  return {
    manifest,
    listDatabases: vi.fn(),
    probeConnection: vi.fn(),
    probeExportReadiness: vi.fn(),
    exportObjects: vi.fn(),
  };
}
