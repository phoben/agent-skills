import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  mkdir,
  lstat,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { DataPullError } from "../core/errors.js";
import type { DatabaseObject } from "../types.js";
import { atomicWriteFile, pathExists } from "../utils/fs.js";
import { safeFileName, validatePathSegment } from "../utils/path.js";

interface LockRecord {
  pid: number;
  runId: string;
  createdAt: string;
  hostname: string;
  targetKey: string;
}

interface TransactionJournal {
  runId: string;
  targetKey: string;
  stage: "prepared" | "replacing" | "committed";
  selectedTypes: string[];
  originalExists: Record<string, boolean>;
  targetDirectory: string;
  stagingDirectory: string;
  backupDirectory: string;
}

export interface TransactionOptions {
  projectRoot: string;
  connectionAlias: string;
  database: string;
  selectedTypes: readonly string[];
  runId?: string;
}

export class OutputTransaction {
  readonly runId: string;
  readonly projectRoot: string;
  readonly storageRoot: string;
  readonly targetDirectory: string;
  readonly stagingDirectory: string;
  readonly backupDirectory: string;
  readonly journalPath: string;
  readonly lockPath: string;
  readonly targetKey: string;
  readonly selectedTypes: readonly string[];
  private lockHeld = false;

  constructor(options: TransactionOptions) {
    const alias = validatePathSegment(options.connectionAlias, "连接别名");
    const database = validatePathSegment(options.database, "数据库名");
    this.runId = options.runId ?? randomUUID();
    this.projectRoot = resolve(options.projectRoot);
    this.storageRoot = join(this.projectRoot, ".database-schema");
    this.targetDirectory = join(this.storageRoot, alias, database);
    this.stagingDirectory = join(this.storageRoot, ".tmp", this.runId);
    this.backupDirectory = join(this.storageRoot, ".backups", this.runId);
    this.journalPath = join(this.storageRoot, ".transactions", `${this.runId}.json`);
    this.targetKey = `${alias}/${database}`;
    this.lockPath = join(
      this.storageRoot,
      ".locks",
      `${createHash("sha256").update(this.targetKey).digest("hex").slice(0, 16)}.lock`,
    );
    this.selectedTypes = [...options.selectedTypes];
    this.assertInsideStorage(this.targetDirectory);
  }

  async acquire(): Promise<void> {
    await this.initializeStorage();
    await this.assertNoSymbolicLinks();
    const record: LockRecord = {
      pid: process.pid,
      runId: this.runId,
      createdAt: new Date().toISOString(),
      hostname: hostname(),
      targetKey: this.targetKey,
    };
    try {
      const handle = await open(this.lockPath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      await handle.close();
      this.lockHeld = true;
    } catch (error) {
      if (!(await pathExists(this.lockPath))) throw error;
      if (!(await this.reclaimStaleLock())) {
        throw new DataPullError(
          "OUTPUT_LOCKED",
          `该连接与数据库已有 DataPull 任务运行：${this.targetKey}`,
          5,
        );
      }
      return this.acquire();
    }
    await this.recoverPendingTransactions();
  }

  async writeObjects(objects: readonly DatabaseObject[]): Promise<Record<string, number>> {
    const selected = new Set(this.selectedTypes);
    const invalid = objects.find((object) => !selected.has(object.type));
    if (invalid !== undefined) {
      throw new DataPullError(
        "DATABASE_OBJECT_READ_FAILED",
        `提取器返回了未选择的对象类型：${invalid.type}`,
        1,
      );
    }
    await rm(this.stagingDirectory, { force: true, recursive: true });
    await mkdir(this.stagingDirectory, { recursive: true });
    for (const type of this.selectedTypes) {
      validatePathSegment(type, "对象类型");
      await mkdir(join(this.stagingDirectory, type), { recursive: true });
    }
    const counts: Record<string, number> = Object.fromEntries(
      this.selectedTypes.map((type) => [type, 0]),
    );
    const collisionCounts = new Map<string, number>();
    for (const object of objects) {
      const collisionKey = `${object.type}\0${object.schema ?? ""}\0${object.name}`;
      collisionCounts.set(collisionKey, (collisionCounts.get(collisionKey) ?? 0) + 1);
    }
    for (const object of objects) {
      const schema = object.schema === undefined ? undefined : validatePathSegment(object.schema, "schema");
      const directory = schema === undefined
        ? join(this.stagingDirectory, object.type)
        : join(this.stagingDirectory, object.type, schema);
      await mkdir(directory, { recursive: true });
      const collisionKey = `${object.type}\0${schema ?? ""}\0${object.name}`;
      const identity = object.identity ?? `${object.type}.${schema ?? ""}.${object.name}`;
      const fileName = safeFileName(
        object.name,
        identity,
        (collisionCounts.get(collisionKey) ?? 0) > 1 || /\([^)]*\)/u.test(identity),
      );
      const target = join(directory, fileName);
      this.assertInsideStorage(target);
      const normalized = validateDdl(object.ddl, identity);
      await writeFile(target, normalized, { encoding: "utf8", flag: "wx" });
      counts[object.type] = (counts[object.type] ?? 0) + 1;
    }
    await this.validateStaging(objects.length);
    return counts;
  }

  async commit(): Promise<void> {
    const originalExists = Object.fromEntries(
      await Promise.all(
        this.selectedTypes.map(async (type) => [
          type,
          await pathExists(join(this.targetDirectory, type)),
        ]),
      ),
    ) as Record<string, boolean>;
    const journal: TransactionJournal = {
      runId: this.runId,
      targetKey: this.targetKey,
      stage: "prepared",
      selectedTypes: [...this.selectedTypes],
      originalExists,
      targetDirectory: this.targetDirectory,
      stagingDirectory: this.stagingDirectory,
      backupDirectory: this.backupDirectory,
    };
    await this.writeJournal(journal);
    try {
      await mkdir(this.targetDirectory, { recursive: true });
      await mkdir(this.backupDirectory, { recursive: true });
      journal.stage = "replacing";
      await this.writeJournal(journal);
      for (const type of this.selectedTypes) {
        const target = join(this.targetDirectory, type);
        const staged = join(this.stagingDirectory, type);
        const backup = join(this.backupDirectory, type);
        if (originalExists[type] === true) await rename(target, backup);
        await rename(staged, target);
      }
      journal.stage = "committed";
      await this.writeJournal(journal);
      try {
        await this.cleanupJournal(journal);
      } catch {
        // 已写入 committed 标记，后续访问会继续执行幂等清理。
      }
    } catch (error) {
      try {
        await this.rollbackJournal(journal);
      } catch (rollbackError) {
        throw new DataPullError(
          "OUTPUT_COMMIT_ROLLBACK_FAILED",
          "结构文件提交失败，且无法完整恢复旧文件。后续运行将再次尝试恢复。",
          1,
          {
            commitError: error instanceof Error ? error.message : String(error),
            rollbackError:
              rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          },
        );
      }
      throw new DataPullError(
        "OUTPUT_COMMIT_FAILED",
        "结构文件提交失败，旧文件已恢复。",
        1,
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async abort(): Promise<void> {
    await rm(this.stagingDirectory, { force: true, recursive: true });
  }

  async release(): Promise<void> {
    if (!this.lockHeld) return;
    await rm(this.lockPath, { force: true });
    this.lockHeld = false;
  }

  private async initializeStorage(): Promise<void> {
    for (const path of [
      this.storageRoot,
      join(this.storageRoot, ".tmp"),
      join(this.storageRoot, ".locks"),
      join(this.storageRoot, ".transactions"),
      join(this.storageRoot, ".backups"),
    ]) {
      await mkdir(path, { recursive: true });
    }
    const gitignore = join(this.storageRoot, ".gitignore");
    const required = [".tmp/", ".locks/", ".transactions/", ".backups/"];
    const existing = (await pathExists(gitignore)) ? await readFile(gitignore, "utf8") : "";
    const lines = new Set(existing.split(/\r?\n/u).filter(Boolean));
    for (const line of required) lines.add(line);
    await atomicWriteFile(gitignore, `${[...lines].join("\n")}\n`);
  }

  private async reclaimStaleLock(): Promise<boolean> {
    let record: LockRecord;
    try {
      record = JSON.parse(await readFile(this.lockPath, "utf8")) as LockRecord;
    } catch {
      return false;
    }
    if (record.hostname !== hostname() || record.targetKey !== this.targetKey) return false;
    try {
      process.kill(record.pid, 0);
      return false;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code !== "ESRCH") return false;
    }
    await rm(this.lockPath, { force: true });
    return true;
  }

  private async recoverPendingTransactions(): Promise<void> {
    const directory = join(this.storageRoot, ".transactions");
    for (const entry of await readdir(directory)) {
      if (!entry.endsWith(".json")) continue;
      const path = join(directory, entry);
      let journal: TransactionJournal;
      try {
        journal = JSON.parse(await readFile(path, "utf8")) as TransactionJournal;
      } catch {
        throw new DataPullError(
          "OUTPUT_COMMIT_ROLLBACK_FAILED",
          `事务日志损坏，无法安全恢复：${path}`,
          1,
        );
      }
      if (journal.targetKey !== this.targetKey) continue;
      this.validateJournalPaths(journal);
      if (journal.stage === "committed") await this.cleanupJournal(journal);
      else await this.rollbackJournal(journal);
    }
  }

  private async rollbackJournal(journal: TransactionJournal): Promise<void> {
    this.validateJournalPaths(journal);
    for (const type of journal.selectedTypes) {
      const target = join(journal.targetDirectory, type);
      const backup = join(journal.backupDirectory, type);
      if (await pathExists(backup)) {
        await rm(target, { force: true, recursive: true });
        await mkdir(journal.targetDirectory, { recursive: true });
        await rename(backup, target);
      } else if (journal.originalExists[type] === false) {
        await rm(target, { force: true, recursive: true });
      }
    }
    await this.cleanupJournal(journal);
  }

  private async cleanupJournal(journal: TransactionJournal): Promise<void> {
    await rm(journal.stagingDirectory, { force: true, recursive: true });
    await rm(journal.backupDirectory, { force: true, recursive: true });
    await rm(join(this.storageRoot, ".transactions", `${journal.runId}.json`), {
      force: true,
    });
  }

  private async writeJournal(journal: TransactionJournal): Promise<void> {
    await atomicWriteFile(this.journalPath, `${JSON.stringify(journal, null, 2)}\n`, 0o600);
  }

  private validateJournalPaths(journal: TransactionJournal): void {
    if (journal.targetKey !== this.targetKey) this.unsafeJournal();
    validatePathSegment(journal.runId, "事务运行 ID");
    if (
      resolve(journal.targetDirectory) !== resolve(this.targetDirectory) ||
      resolve(journal.stagingDirectory) !==
        resolve(this.storageRoot, ".tmp", journal.runId) ||
      resolve(journal.backupDirectory) !==
        resolve(this.storageRoot, ".backups", journal.runId)
    ) {
      this.unsafeJournal();
    }
    for (const path of [
      journal.targetDirectory,
      journal.stagingDirectory,
      journal.backupDirectory,
    ]) {
      this.assertInsideStorage(path);
    }
  }

  private async validateStaging(expectedObjects: number): Promise<void> {
    let files = 0;
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile() && entry.name.endsWith(".sql")) {
          if ((await stat(path)).size === 0) {
            throw new DataPullError(
              "DATABASE_OBJECT_READ_FAILED",
              `暂存结构文件为空：${path}`,
              1,
            );
          }
          files += 1;
        }
      }
    };
    await visit(this.stagingDirectory);
    if (files !== expectedObjects) {
      throw new DataPullError(
        "DATABASE_OBJECT_READ_FAILED",
        `暂存对象数量不一致：期望 ${expectedObjects}，实际 ${files}。`,
        1,
      );
    }
  }

  private assertInsideStorage(path: string): void {
    const root = resolve(this.storageRoot);
    const target = resolve(path);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw new DataPullError("OUTPUT_PATH_UNSAFE", `输出路径越出项目目录：${path}`, 5);
    }
  }

  private async assertNoSymbolicLinks(): Promise<void> {
    const paths = [
      this.storageRoot,
      join(this.storageRoot, ".tmp"),
      join(this.storageRoot, ".locks"),
      join(this.storageRoot, ".transactions"),
      join(this.storageRoot, ".backups"),
      dirnameIfDifferent(this.targetDirectory, this.storageRoot),
      this.targetDirectory,
    ];
    for (const path of paths) {
      if (!(await pathExists(path))) continue;
      if ((await lstat(path)).isSymbolicLink()) {
        throw new DataPullError(
          "OUTPUT_PATH_UNSAFE",
          `拒绝通过符号链接写入结构文件：${path}`,
          5,
        );
      }
    }
  }

  private unsafeJournal(): never {
    throw new DataPullError(
      "OUTPUT_COMMIT_ROLLBACK_FAILED",
      "事务日志目标与当前输出目标不一致，已停止恢复。",
      1,
    );
  }
}

function validateDdl(ddl: string, identity: string): string {
  const normalized = ddl.replaceAll("\r\n", "\n").trim();
  if (normalized.length === 0) {
    throw new DataPullError(
      "DATABASE_OBJECT_READ_FAILED",
      `对象 ${identity} 的 DDL 为空。`,
      1,
    );
  }
  if (
    /\bDEFINER\s*=/iu.test(normalized) ||
    /^\s*(GRANT|REVOKE)\b/imu.test(normalized) ||
    /\bOWNER\s+TO\b/iu.test(normalized)
  ) {
    throw new DataPullError(
      "DATABASE_OBJECT_READ_FAILED",
      `对象 ${identity} 的 DDL 包含禁止的所有者或授权内容。`,
      1,
    );
  }
  return `${normalized}\n`;
}

function dirnameIfDifferent(path: string, root: string): string {
  const parent = resolve(path, "..");
  return parent === resolve(root) ? root : parent;
}
