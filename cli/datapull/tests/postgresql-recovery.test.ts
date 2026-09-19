import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataPullError } from "../src/core/errors.js";
import { PostgreSqlExporter } from "../src/exporters/postgresql.js";
import { runProcess } from "../src/process/runner.js";
import { databaseProviders } from "../src/providers/builtin.js";
import type { ResolvedConnection } from "../src/types.js";

vi.mock("../src/process/runner.js", () => ({
  runProcess: vi.fn(),
}));

const connection: ResolvedConnection = {
  alias: "main",
  engine: "postgresql",
  authMode: "password",
  host: "db.example.internal",
  port: 5432,
  username: "reader",
  password: "secret",
  recentDatabases: [],
  favoriteDatabases: [],
};

describe("PostgreSQL psql 故障恢复", () => {
  beforeEach(() => {
    vi.mocked(runProcess).mockReset();
  });

  it("连接级瞬时失败后自动重试只读查询", async () => {
    vi.mocked(runProcess)
      .mockRejectedValueOnce(
        new DataPullError("DATABASE_CLIENT_FAILED", "psql 执行失败。", 1, {
          command: "psql",
          exitCode: 2,
          timedOut: false,
          detail: "server closed the connection unexpectedly",
        }),
      )
      .mockResolvedValueOnce({ stdout: '"18.6"\n', stderr: "" });

    await expect(
      databaseProviders.get("postgresql").probeExportReadiness(connection, {
        database: "app",
        objectTypes: ["table"],
      }),
    ).resolves.toEqual({
      serverVersion: "18.6",
    });
    expect(runProcess).toHaveBeenCalledTimes(2);
  });

  it("SQL 或权限错误不重试并标明读取阶段", async () => {
    vi.mocked(runProcess).mockRejectedValueOnce(
      new DataPullError("DATABASE_CLIENT_FAILED", "psql 执行失败。", 1, {
        command: "psql",
        exitCode: 3,
        timedOut: false,
        detail: "ERROR: permission denied for relation pg_proc",
      }),
    );

    await expect(new PostgreSqlExporter().test(connection, "app")).rejects.toMatchObject({
      code: "DATABASE_CLIENT_FAILED",
      message: "PostgreSQL 读取服务端版本失败。",
      details: expect.objectContaining({
        operation: "读取服务端版本",
        attempts: 1,
        detail: "ERROR: permission denied for relation pg_proc",
      }),
    });
    expect(runProcess).toHaveBeenCalledTimes(1);
  });

  it("逐表导出时报告总量和当前进度", async () => {
    vi.mocked(runProcess)
      .mockResolvedValueOnce({
        stdout: [
          JSON.stringify({ schema: "public", name: "orders", kind: "r", ddl: null }),
          JSON.stringify({ schema: "sales", name: "items", kind: "p", ddl: null }),
        ].join("\n"),
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: "CREATE TABLE public.orders (id bigint);\n",
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: "CREATE TABLE sales.items (id bigint);\n",
        stderr: "",
      });
    const stages: string[] = [];

    const objects = await new PostgreSqlExporter().exportObjects(
      connection,
      "app",
      ["table"],
      (stage) => stages.push(stage),
    );

    expect(objects).toHaveLength(2);
    expect(stages).toEqual([
      "读取 PostgreSQL 表结构（1/2）：public.orders",
      "读取 PostgreSQL 表结构（2/2）：sales.items",
    ]);
  });

  it("pg_dump 遇到连接中断时重试当前表", async () => {
    vi.mocked(runProcess)
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ schema: "public", name: "orders", kind: "r", ddl: null }),
        stderr: "",
      })
      .mockRejectedValueOnce(
        new DataPullError("DATABASE_CLIENT_FAILED", "pg_dump 执行失败。", 1, {
          command: "pg_dump",
          exitCode: 1,
          timedOut: false,
          detail: "server closed the connection unexpectedly",
        }),
      )
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ schema: "public", name: "orders", kind: "r", ddl: null }),
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: "CREATE TABLE public.orders (id bigint);\n",
        stderr: "",
      });

    const objects = [];
    for await (const object of databaseProviders
      .get("postgresql")
      .exportObjects(connection, "app", ["table"])) {
      objects.push(object);
    }

    expect(objects).toHaveLength(1);
    expect(runProcess).toHaveBeenCalledTimes(4);
  });

  it("大批量表使用固定上限并发，避免串行执行或压垮数据库", async () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      schema: "public",
      name: `table_${index + 1}`,
      kind: "r",
      ddl: null,
    }));
    let active = 0;
    let maximumActive = 0;
    vi.mocked(runProcess).mockImplementation(async (command) => {
      if (command === "psql") {
        return { stdout: rows.map((row) => JSON.stringify(row)).join("\n"), stderr: "" };
      }
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return { stdout: "CREATE TABLE public.sample (id bigint);\n", stderr: "" };
    });

    const objects = await new PostgreSqlExporter().exportObjects(
      connection,
      "app",
      ["table"],
    );

    expect(objects).toHaveLength(8);
    expect(maximumActive).toBe(4);
  });

  it("任一并发表失败后等待在途任务结束且不再启动新表", async () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      schema: "public",
      name: `table_${index + 1}`,
      kind: "r",
      ddl: null,
    }));
    let pgDumpCalls = 0;
    vi.mocked(runProcess).mockImplementation(async (command) => {
      if (command === "psql") {
        return { stdout: rows.map((row) => JSON.stringify(row)).join("\n"), stderr: "" };
      }
      pgDumpCalls += 1;
      if (pgDumpCalls === 1) {
        throw new DataPullError("DATABASE_CLIENT_FAILED", "pg_dump 执行失败。", 1, {
          command: "pg_dump",
          exitCode: 1,
          timedOut: false,
          detail: "permission denied",
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { stdout: "CREATE TABLE public.sample (id bigint);\n", stderr: "" };
    });

    await expect(
      new PostgreSqlExporter().exportObjects(connection, "app", ["table"]),
    ).rejects.toMatchObject({
      code: "DATABASE_CLIENT_FAILED",
      message: "PostgreSQL 读取表 public.table_1失败。",
    });
    expect(pgDumpCalls).toBe(4);
  });
});
