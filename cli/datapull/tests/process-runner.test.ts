import { describe, expect, it } from "vitest";
import { DataPullError } from "../src/core/errors.js";
import { runProcess } from "../src/process/runner.js";

describe("外部进程执行器", () => {
  it("在超时时保留诊断信息并隐藏秘密", async () => {
    const secret = "runner-secret";
    let thrown: unknown;

    try {
      await runProcess(
        process.execPath,
        [
          "-e",
          `process.stderr.write('阶段：连接 ${secret}\\n'); setTimeout(() => {}, 10_000);`,
        ],
        { timeoutMs: 100, secrets: [secret] },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DataPullError);
    expect(thrown).toMatchObject({
      code: "DATABASE_CLIENT_FAILED",
      message: expect.stringContaining("执行超时"),
      details: {
        timedOut: true,
        timeoutMs: 100,
        detail: expect.stringContaining("阶段：连接 ***"),
      },
    });
  });
});
