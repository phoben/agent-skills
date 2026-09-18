import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillInstaller } from "../src/skills/installer.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe("DataPull Skill 安装保护", () => {
  it("识别用户修改并只在强制同步前创建备份", async () => {
    const root = await mkdtemp(join(tmpdir(), "datapull-skill-test-"));
    directories.push(root);
    const target = { agent: "codex" as const, scope: "project" as const, path: join(root, ".agents", "skills", "datapull") };
    const installer = new SkillInstaller();
    await installer.install(target, true);
    expect((await installer.status(target)).status).toBe("current");
    const skillPath = join(target.path, "SKILL.md");
    await writeFile(skillPath, `${await readFile(skillPath, "utf8")}\n用户说明\n`);
    expect((await installer.status(target)).status).toBe("modified");
    expect((await installer.sync(target, true, false)).status).toBe("modified");
    expect((await installer.sync(target, true, true)).status).toBe("synced");
  });

  it("拒绝经符号链接写入 Agent Skill 目录", async () => {
    const root = await mkdtemp(join(tmpdir(), "datapull-skill-link-test-"));
    const external = await mkdtemp(join(tmpdir(), "datapull-skill-external-test-"));
    directories.push(root, external);
    await mkdir(join(external, "skills"), { recursive: true });
    await symlink(external, join(root, ".agents"), process.platform === "win32" ? "junction" : "dir");
    const target = {
      agent: "codex" as const,
      scope: "project" as const,
      path: join(root, ".agents", "skills", "datapull"),
    };

    await expect(new SkillInstaller().install(target, true)).rejects.toMatchObject({
      code: "OUTPUT_PATH_UNSAFE",
    });
  });
});
