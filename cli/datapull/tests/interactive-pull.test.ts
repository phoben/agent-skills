import { confirm, input } from "@inquirer/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promptImmediatePull } from "../src/interactive/pull.js";
import type { ConnectionConfig } from "../src/types.js";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
}));

const connection: ConnectionConfig = {
  alias: "main",
  engine: "mysql",
  authMode: "password",
  host: "db.local",
  port: 3306,
  username: "reader",
  credentialRef: "MAIN_PASSWORD",
  recentDatabases: [],
  favoriteDatabases: [],
};

describe("新增连接后的立即拉取", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("用户拒绝时不询问数据库也不执行拉取", async () => {
    vi.mocked(confirm).mockResolvedValueOnce(false);
    const execute = vi.fn();

    const result = await promptImmediatePull({} as never, connection, {
      projectRoot: "C:\\workspace",
      pullService: { execute },
    });

    expect(result).toBeUndefined();
    expect(input).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("用户同意后输入数据库名并拉取全部对象类型", async () => {
    vi.mocked(confirm).mockResolvedValueOnce(true);
    vi.mocked(input).mockResolvedValueOnce("app");
    const pullResult = {
      connectionAlias: "main",
      engine: "mysql" as const,
      database: "app",
      projectRoot: "C:\\workspace",
      outputPath: "C:\\workspace\\.database-schema\\main\\app",
      updatedTypes: ["table", "view", "function", "procedure", "trigger", "event"],
      preservedTypes: [],
      objectCounts: { table: 2, view: 1 },
      installation: [],
    };
    const execute = vi.fn().mockResolvedValue(pullResult);

    const result = await promptImmediatePull({} as never, connection, {
      projectRoot: "C:\\workspace",
      pullService: { execute },
    });

    expect(input).toHaveBeenCalledWith({ message: "目标数据库名：", required: true });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionAlias: "main",
        database: "app",
        include: ["table", "view", "function", "procedure", "trigger", "event"],
        installMissing: false,
        confirmed: true,
        projectRoot: "C:\\workspace",
      }),
    );
    expect(result).toBe(pullResult);
  });
});
