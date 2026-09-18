import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigStore } from "../src/config/store.js";
import type { CredentialSecurity } from "../src/config/security.js";
import { getConfigPaths } from "../src/config/paths.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe("全局配置与凭证", () => {
  it("分别保存配置引用与秘密值", async () => {
    const root = await temporaryDirectory();
    const security = {
      secureDirectory: async () => undefined,
      secureFile: async () => undefined,
      verifyFile: async () => undefined,
    } as unknown as CredentialSecurity;
    const store = new ConfigStore(getConfigPaths("linux", { DATAPULL_CONFIG_HOME: root }), security);
    expect(await store.initialize()).toBe(true);
    await store.setCredential("APP_PASSWORD", "top-secret");
    const config = await store.read();
    expect(config.connections).toEqual([]);
    expect(await store.resolveSecret("APP_PASSWORD")).toBe("top-secret");
    expect(await readFile(store.paths.config, "utf8")).not.toContain("top-secret");
    expect(await readFile(store.paths.credentials, "utf8")).toContain("APP_PASSWORD");
  });

  it("进程环境优先于凭证文件", async () => {
    const root = await temporaryDirectory();
    const security = {
      secureDirectory: async () => undefined,
      secureFile: async () => undefined,
      verifyFile: async () => undefined,
    } as unknown as CredentialSecurity;
    const store = new ConfigStore(getConfigPaths("linux", { DATAPULL_CONFIG_HOME: root }), security);
    await store.initialize();
    await store.setCredential("APP_PASSWORD", "file-value");
    process.env.APP_PASSWORD = "process-value";
    try {
      expect(await store.resolveSecret("APP_PASSWORD")).toBe("process-value");
    } finally {
      delete process.env.APP_PASSWORD;
    }
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "datapull-config-test-"));
  directories.push(directory);
  return directory;
}
