import { afterEach, describe, expect, it, vi } from "vitest";
import { DataPullError } from "../src/core/errors.js";
import { Output } from "../src/core/output.js";

describe("人类可读错误输出", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("数据库客户端失败时展示已脱敏详情和恢复提示", () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const output = new Output({ command: "pull", json: false });

    output.failure(
      new DataPullError(
        "DATABASE_CLIENT_FAILED",
        "PostgreSQL 读取函数和存储过程元数据失败。",
        1,
        {
          detail: "psql: error: server closed the connection unexpectedly (password=***)",
        },
      ),
    );

    const rendered = write.mock.calls.map(([value]) => String(value)).join("");
    expect(rendered).toContain("客户端详情（已脱敏）");
    expect(rendered).toContain("server closed the connection unexpectedly");
    expect(rendered).toContain("可使用 --json 获取结构化错误信息");
  });
});
