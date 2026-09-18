import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { OutputTransaction } from "../src/output/transaction.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe("结构文件事务", () => {
  it("只更新所选类型并保留其他旧对象", async () => {
    const root = await temporaryDirectory();
    const oldView = join(root, ".database-schema", "main", "app", "view", "public", "old.sql");
    await mkdir(join(oldView, ".."), { recursive: true });
    await writeFile(oldView, "CREATE VIEW old AS SELECT 1;\n");
    const transaction = new OutputTransaction({
      projectRoot: root,
      connectionAlias: "main",
      database: "app",
      selectedTypes: ["table"],
    });
    await transaction.acquire();
    try {
      expect(
        await transaction.writeObjects([
          { type: "table", schema: "public", name: "users", ddl: "CREATE TABLE users(id int);" },
        ]),
      ).toEqual({ table: 1 });
      await transaction.commit();
    } finally {
      await transaction.release();
    }
    expect(await readFile(oldView, "utf8")).toContain("CREATE VIEW");
    const tables = await readdir(join(root, ".database-schema", "main", "app", "table", "public"));
    expect(tables).toEqual(["users.sql"]);
  });

  it("同目录同名重载对象都使用稳定哈希", async () => {
    const root = await temporaryDirectory();
    const transaction = new OutputTransaction({
      projectRoot: root,
      connectionAlias: "main",
      database: "app",
      selectedTypes: ["function"],
    });
    await transaction.acquire();
    try {
      await transaction.writeObjects([
        { type: "function", schema: "public", name: "search", identity: "public.search(text)", ddl: "CREATE FUNCTION search(text) RETURNS int AS 'x';" },
        { type: "function", schema: "public", name: "search", identity: "public.search(int)", ddl: "CREATE FUNCTION search(int) RETURNS int AS 'x';" },
      ]);
      await transaction.commit();
    } finally {
      await transaction.release();
    }
    const files = await readdir(join(root, ".database-schema", "main", "app", "function", "public"));
    expect(files).toHaveLength(2);
    expect(files.every((file) => /^search--[a-f0-9]{10}\.sql$/u.test(file))).toBe(true);
  });

  it("启动时回收陈旧锁并恢复未完成的跨类型提交", async () => {
    const root = await temporaryDirectory();
    const transaction = new OutputTransaction({
      projectRoot: root,
      connectionAlias: "main",
      database: "app",
      selectedTypes: ["table", "view"],
      runId: "new-run",
    });
    const storage = join(root, ".database-schema");
    const target = join(storage, "main", "app");
    const backup = join(storage, ".backups", "old-run");
    await mkdir(join(target, "table"), { recursive: true });
    await mkdir(join(target, "view"), { recursive: true });
    await mkdir(join(backup, "table"), { recursive: true });
    await mkdir(join(storage, ".transactions"), { recursive: true });
    await mkdir(join(storage, ".locks"), { recursive: true });
    await writeFile(join(target, "table", "new.sql"), "new");
    await writeFile(join(target, "view", "old.sql"), "old-view");
    await writeFile(join(backup, "table", "old.sql"), "old-table");
    await writeFile(
      join(storage, ".transactions", "old-run.json"),
      JSON.stringify({
        runId: "old-run",
        targetKey: "main/app",
        stage: "replacing",
        selectedTypes: ["table", "view"],
        originalExists: { table: true, view: true },
        targetDirectory: target,
        stagingDirectory: join(storage, ".tmp", "old-run"),
        backupDirectory: backup,
      }),
    );
    await writeFile(
      transaction.lockPath,
      JSON.stringify({
        pid: 2_147_483_647,
        runId: "old-run",
        createdAt: new Date(0).toISOString(),
        hostname: hostname(),
        targetKey: "main/app",
      }),
    );
    await transaction.acquire();
    try {
      expect(await readFile(join(target, "table", "old.sql"), "utf8")).toBe("old-table");
      expect(await readFile(join(target, "view", "old.sql"), "utf8")).toBe("old-view");
    } finally {
      await transaction.release();
    }
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "datapull-transaction-test-"));
  directories.push(directory);
  return directory;
}
