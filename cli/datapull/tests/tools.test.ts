import { describe, expect, it } from "vitest";
import { INSTALL_ADAPTER_VERSION, installationPlan } from "../src/tools/catalog.js";

describe("数据库工具安装适配目录", () => {
  it("记录版本、官方来源、命令、权限和下载影响", () => {
    const plan = installationPlan("sqlcmd", "win32");
    expect(plan).toMatchObject({
      adapterVersion: INSTALL_ADAPTER_VERSION,
      tool: "sqlcmd",
      command: "winget",
    });
    expect(plan?.sourceUrl).toMatch(/^https:\/\//u);
    expect(plan?.permission).not.toBe("");
    expect(plan?.downloadImpact).not.toBe("");
  });

  it("未验证的 Linux 发行版不猜测安装命令", () => {
    expect(installationPlan("psql", "linux", "arch")).toBeUndefined();
  });
});
