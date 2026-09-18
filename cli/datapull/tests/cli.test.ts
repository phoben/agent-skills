import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
const packageRoot = resolve(import.meta.dirname, "..");

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe("CLI JSON 契约", () => {
  it("非 TTY 无参数只输出一个 JSON 并返回退出码 2", async () => {
    const result = await runCli(["--json"]);
    expect(result.exitCode).toBe(2);
    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(payload).toMatchObject({ ok: false, command: "datapull" });
    expect(result.stdout.trim().split(/\r?\n/u)).toHaveLength(1);
  });

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
  });

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
  });
});

async function runCli(args: string[], env = process.env) {
  return execa(process.execPath, ["--import", "tsx", "src/index.ts", ...args], {
    cwd: packageRoot,
    env,
    reject: false,
  });
}
