import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { databaseProviders } from "../src/providers/builtin.js";

const directories: string[] = [];
const packageRoot = resolve(import.meta.dirname, "..");

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe("CLI JSON 契约", () => {
  it("帮助文本覆盖新增连接后立即拉取与模拟示例", async () => {
    const rootHelp = await runCli(["--help"]);
    const addHelp = await runCli(["connection", "add", "--help"]);
    const pullHelp = await runCli(["pull", "--help"]);

    expect(rootHelp.exitCode).toBe(0);
    expect(rootHelp.stdout).toContain("datapull connection add");
    expect(rootHelp.stdout).toContain("不导出业务数据");
    expect(rootHelp.stdout).toContain("全部、常用、高级、自定义四类询问对象范围");
    expect(addHelp.exitCode).toBe(0);
    expect(addHelp.stdout).toContain("mysql.demo.example");
    expect(addHelp.stdout).toContain("目标数据库        shop_demo");
    expect(addHelp.stdout).toContain("非交互模式只登记连接");
    for (const provider of databaseProviders.list()) {
      expect(rootHelp.stdout).toContain(provider.manifest.displayName);
      expect(addHelp.stdout).toContain(provider.manifest.id);
    }
    expect(pullHelp.exitCode).toBe(0);
    expect(pullHelp.stdout).toContain("--include 时拉取当前数据库引擎支持的全部对象类型");
    expect(pullHelp.stdout).toContain(".database-schema/<连接别名>/<数据库名>/");
  }, 15_000);

  it("非 TTY 无参数只输出一个 JSON 并返回退出码 2", async () => {
    const result = await runCli(["--json"]);
    expect(result.exitCode).toBe(2);
    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(payload).toMatchObject({ ok: false, command: "datapull" });
    expect(result.stdout.trim().split(/\r?\n/u)).toHaveLength(1);
  }, 15_000);

  it("非交互密码连接省略变量名时按别名生成稳定引用", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "datapull-cli-default-reference-test-"));
    directories.push(configRoot);
    const env = {
      ...process.env,
      DATAPULL_CONFIG_HOME: configRoot,
      DATAPULL_YUGA_SQLSERVER_PASSWORD: "top-secret",
    };
    const added = await runCli(
      [
        "connection",
        "add",
        "--alias",
        "yuga-sqlserver",
        "--engine",
        "sqlserver",
        "--auth-mode",
        "password",
        "--host",
        "db.local",
        "--username",
        "reader",
        "--yes",
        "--json",
      ],
      env,
    );

    expect(added.exitCode).toBe(0);
    expect(JSON.parse(added.stdout)).toMatchObject({
      credentialRef: "DATAPULL_YUGA_SQLSERVER_PASSWORD",
    });
    expect(added.stdout).not.toContain("top-secret");
  }, 15_000);

  it("非交互新增连接后可脱敏列出", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "datapull-cli-test-"));
    directories.push(configRoot);
    const env = {
      ...process.env,
      DATAPULL_CONFIG_HOME: configRoot,
      APP_PASSWORD: "top-secret",
    };
    const added = await runCli(
      [
        "connection",
        "add",
        "--alias",
        "main",
        "--engine",
        "postgresql",
        "--auth-mode",
        "password",
        "--host",
        "db.local",
        "--username",
        "reader",
        "--credential-ref",
        "APP_PASSWORD",
        "--yes",
        "--json",
      ],
      env,
    );
    expect(added.exitCode).toBe(0);
    expect(added.stdout).not.toContain("top-secret");
    const listed = await runCli(["connection", "list", "--json"], env);
    expect(listed.exitCode).toBe(0);
    expect(JSON.parse(listed.stdout)).toMatchObject({
      ok: true,
      connections: [{ alias: "main", engine: "postgresql", credentialRef: "APP_PASSWORD" }],
    });
    expect(listed.stdout).not.toContain("top-secret");
  }, 15_000);

  it("缺少工具且未确认安装时返回完整安装计划", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "datapull-cli-plan-test-"));
    directories.push(configRoot);
    const env = {
      ...process.env,
      DATAPULL_CONFIG_HOME: configRoot,
      APP_PASSWORD: "top-secret",
    };
    await runCli(
      [
        "connection",
        "add",
        "--alias",
        "main",
        "--engine",
        "postgresql",
        "--auth-mode",
        "password",
        "--host",
        "db.local",
        "--username",
        "reader",
        "--credential-ref",
        "APP_PASSWORD",
        "--yes",
        "--json",
      ],
      env,
    );
    const result = await runCli(
      [
        "pull",
        "--connection",
        "main",
        "--database",
        "app",
        "--install-missing",
        "--json",
      ],
      { ...env, PATH: "" },
    );
    expect(result.exitCode).toBe(2);
    const payload = JSON.parse(result.stdout) as {
      actionPlan?: { installation?: unknown[] };
      error?: { code?: string };
    };
    expect(payload.error?.code).toBe("CONFIRMATION_REQUIRED");
    expect(payload.actionPlan?.installation?.length).toBeGreaterThan(0);
    expect(result.stdout.trim().split(/\r?\n/u)).toHaveLength(1);

    const humanResult = await runCli(
      [
        "pull",
        "--connection",
        "main",
        "--database",
        "app",
        "--install-missing",
      ],
      { ...env, PATH: "" },
    );
    expect(humanResult.exitCode).toBe(2);
    expect(humanResult.stderr).toContain("手工安装指引");
    expect(humanResult.stderr).toContain("来源：");
    expect(humanResult.stderr).toContain("权限：");
    expect(humanResult.stderr).toContain("下载影响：");
    expect(humanResult.stderr).not.toContain("top-secret");
  }, 15_000);

  it("可显式保存和恢复 SQL Server 证书验证策略", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "datapull-cli-sqlserver-tls-test-"));
    directories.push(configRoot);
    const env = {
      ...process.env,
      DATAPULL_CONFIG_HOME: configRoot,
      APP_PASSWORD: "top-secret",
    };
    const added = await runCli(
      [
        "connection",
        "add",
        "--alias",
        "sqlserver-main",
        "--engine",
        "sqlserver",
        "--auth-mode",
        "password",
        "--host",
        "db.local",
        "--username",
        "reader",
        "--credential-ref",
        "APP_PASSWORD",
        "--trust-server-certificate",
        "--yes",
        "--json",
      ],
      env,
    );
    expect(added.exitCode).toBe(0);
    expect(JSON.parse(added.stdout)).toMatchObject({
      tls: { encrypt: true, trustServerCertificate: true },
      securityWarnings: [expect.stringContaining("不会验证 SQL Server 身份")],
    });

    const updated = await runCli(
      [
        "connection",
        "update",
        "--alias",
        "sqlserver-main",
        "--verify-server-certificate",
        "--yes",
        "--json",
      ],
      env,
    );
    expect(updated.exitCode).toBe(0);
    expect(JSON.parse(updated.stdout)).toMatchObject({
      tls: { encrypt: true, trustServerCertificate: false },
    });
    expect(JSON.parse(updated.stdout)).not.toHaveProperty("securityWarnings");
  }, 15_000);
});

async function runCli(args: string[], env = process.env) {
  return execa(process.execPath, ["--import", "tsx", "src/index.ts", ...args], {
    cwd: packageRoot,
    env,
    reject: false,
  });
}
