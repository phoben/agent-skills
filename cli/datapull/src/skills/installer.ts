import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DataPullError } from "../core/errors.js";
import { pathExists } from "../utils/fs.js";
import type { SkillTarget } from "./targets.js";

interface InstallationMetadata {
  version: 1;
  skillVersion: string;
  sourceHash: string;
  installedHash: string;
  installedAt: string;
  agent: string;
  scope: string;
}

export interface SkillStatus {
  agent: string;
  scope: string;
  path: string;
  status: "missing" | "current" | "outdated" | "modified" | "unmanaged" | "installed" | "synced";
  version?: string | undefined;
  modified: boolean;
  action: string;
  error?: string | undefined;
}

export class SkillInstaller {
  readonly sourceDirectory = fileURLToPath(new URL("../../skill", import.meta.url));

  async sourceHash(): Promise<string> {
    return hashDirectory(this.sourceDirectory);
  }

  async status(target: SkillTarget): Promise<SkillStatus> {
    if (!(await pathExists(target.path))) return this.result(target, "missing", false, "none");
    await assertNotSymbolicLink(target.path);
    const metadataPath = join(target.path, ".datapull-skill.json");
    if (!(await pathExists(metadataPath))) return this.result(target, "unmanaged", true, "review");
    try {
      const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as InstallationMetadata;
      const installedHash = await hashDirectory(target.path, [".datapull-skill.json"]);
      const currentHash = await this.sourceHash();
      if (installedHash !== metadata.installedHash) {
        return this.result(target, "modified", true, "preserve", metadata.skillVersion);
      }
      if (currentHash !== metadata.sourceHash) {
        return this.result(target, "outdated", false, "sync", metadata.skillVersion);
      }
      return this.result(target, "current", false, "none", metadata.skillVersion);
    } catch (error) {
      return {
        ...this.result(target, "unmanaged", true, "review"),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async install(target: SkillTarget, confirmed: boolean): Promise<SkillStatus> {
    if (!confirmed) this.confirmationRequired(target);
    await this.validateTarget(target);
    if (await pathExists(target.path)) {
      const current = await this.status(target);
      if (current.status !== "missing") {
        throw new DataPullError(
          "SKILL_TARGET_EXISTS",
          `目标 Skill 已存在，使用 skill status 或 skill sync 处理：${target.path}`,
          5,
          { target: current },
        );
      }
    }
    await this.replaceFromSource(target, "installed");
    return this.statusAfterAction(target, "installed");
  }

  async sync(target: SkillTarget, confirmed: boolean, force: boolean): Promise<SkillStatus> {
    if (!confirmed) this.confirmationRequired(target);
    await this.validateTarget(target);
    const current = await this.status(target);
    if (current.status === "missing") return this.install(target, confirmed);
    if (current.status === "current") return current;
    if ((current.status === "modified" || current.status === "unmanaged") && !force) {
      return current;
    }
    if (force) await this.backup(target);
    await this.replaceFromSource(target, "synced");
    return this.statusAfterAction(target, "synced");
  }

  private async replaceFromSource(target: SkillTarget, action: "installed" | "synced"): Promise<void> {
    const temporary = `${target.path}.datapull-${process.pid}.tmp`;
    await rm(temporary, { force: true, recursive: true });
    await mkdir(dirname(target.path), { recursive: true });
    await cp(this.sourceDirectory, temporary, { recursive: true, errorOnExist: true });
    const sourceHash = await this.sourceHash();
    const installedHash = await hashDirectory(temporary);
    const metadata: InstallationMetadata = {
      version: 1,
      skillVersion: await packageVersion(),
      sourceHash,
      installedHash,
      installedAt: new Date().toISOString(),
      agent: target.agent,
      scope: target.scope,
    };
    await writeFile(
      join(temporary, ".datapull-skill.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );
    if (await pathExists(target.path)) await rm(target.path, { force: true, recursive: true });
    await rename(temporary, target.path);
    const result = await this.status(target);
    if (result.status !== "current") {
      throw new DataPullError(
        "SKILL_INSTALL_VALIDATION_FAILED",
        `Skill ${action === "installed" ? "安装" : "同步"}后回验失败：${target.path}`,
        5,
        { target: result },
      );
    }
  }

  private async backup(target: SkillTarget): Promise<string> {
    const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const backup = join(dirname(target.path), `${basename(target.path)}.backup-${stamp}`);
    await cp(target.path, backup, { recursive: true, errorOnExist: true });
    if (!(await pathExists(join(backup, "SKILL.md")))) {
      throw new DataPullError("SKILL_BACKUP_FAILED", "Skill 备份回验失败。", 5);
    }
    return backup;
  }

  private async validateTarget(target: SkillTarget): Promise<void> {
    const absolute = resolve(target.path);
    const root = resolve(dirname(dirname(dirname(target.path))));
    const relativeTarget = relative(root, absolute);
    if (
      relativeTarget.length === 0 ||
      relativeTarget === ".." ||
      relativeTarget.startsWith(`..${sep}`) ||
      resolve(root, relativeTarget) !== absolute
    ) {
      throw new DataPullError("OUTPUT_PATH_UNSAFE", `Skill 路径无效：${target.path}`, 5);
    }
    await assertNoSymbolicLinks(root, relativeTarget);
  }

  private confirmationRequired(target: SkillTarget): never {
    throw new DataPullError(
      "CONFIRMATION_REQUIRED",
      "写入 Agent Skill 目录需要显式确认。",
      2,
      { target },
    );
  }

  private result(
    target: SkillTarget,
    status: SkillStatus["status"],
    modified: boolean,
    action: string,
    version?: string,
  ): SkillStatus {
    return {
      agent: target.agent,
      scope: target.scope,
      path: target.path,
      status,
      modified,
      action,
      ...(version === undefined ? {} : { version }),
    };
  }

  private async statusAfterAction(
    target: SkillTarget,
    action: "installed" | "synced",
  ): Promise<SkillStatus> {
    const status = await this.status(target);
    return { ...status, status: action, action };
  }
}

async function hashDirectory(directory: string, ignored: string[] = []): Promise<string> {
  const hash = createHash("sha256");
  const visit = async (current: string): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(current, entry.name);
      const relativePath = relative(directory, path).replaceAll("\\", "/");
      if (ignored.includes(relativePath)) continue;
      if (entry.isSymbolicLink()) {
        throw new DataPullError("OUTPUT_PATH_UNSAFE", `Skill 源码包含符号链接：${path}`, 5);
      }
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        hash.update(relativePath);
        hash.update("\0");
        hash.update(await readFile(path));
        hash.update("\0");
      }
    }
  };
  await visit(directory);
  return hash.digest("hex");
}

async function assertNotSymbolicLink(path: string): Promise<void> {
  if ((await lstat(path)).isSymbolicLink()) {
    throw new DataPullError("OUTPUT_PATH_UNSAFE", `拒绝写入符号链接 Skill 目录：${path}`, 5);
  }
}

async function assertNoSymbolicLinks(root: string, relativeTarget: string): Promise<void> {
  let current = root;
  for (const segment of relativeTarget.split(sep)) {
    current = join(current, segment);
    if (await pathExists(current)) await assertNotSymbolicLink(current);
  }
}

async function packageVersion(): Promise<string> {
  const packagePath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const parsed = JSON.parse(await readFile(packagePath, "utf8")) as { version?: string };
  return parsed.version ?? "0.0.0";
}
