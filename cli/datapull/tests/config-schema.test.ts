import { describe, expect, it } from "vitest";
import { connectionSchema } from "../src/config/schema.js";

describe("连接配置安全约束", () => {
  it("要求 SQL Server 启用加密并允许显式信任服务器证书", () => {
    const base = {
      alias: "sqlserver-main",
      engine: "sqlserver" as const,
      authMode: "integrated" as const,
      host: "sqlserver.example.com",
      recentDatabases: [],
      favoriteDatabases: [],
    };

    expect(
      connectionSchema.safeParse({
        ...base,
        tls: { encrypt: true, trustServerCertificate: false },
      }).success,
    ).toBe(true);
    expect(
      connectionSchema.safeParse({
        ...base,
        tls: { encrypt: true, trustServerCertificate: true },
      }).success,
    ).toBe(true);
    expect(
      connectionSchema.safeParse({
        ...base,
        tls: { encrypt: false, trustServerCertificate: false },
      }).success,
    ).toBe(false);
    expect(connectionSchema.safeParse(base).success).toBe(false);
  });
});
