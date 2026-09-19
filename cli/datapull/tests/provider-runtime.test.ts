import { describe, expect, it, vi } from "vitest";
import { DataPullError } from "../src/core/errors.js";
import { ProviderRuntime } from "../src/providers/runtime.js";

describe("Provider 公共运行策略", () => {
  it("仅对明确分类的瞬态读取错误执行有限重试", async () => {
    const delay = vi.fn().mockResolvedValue(undefined);
    const runtime = new ProviderRuntime({ maxAttempts: 3, baseDelayMs: 10, delay });
    const action = vi
      .fn()
      .mockRejectedValueOnce(clientError("connection reset"))
      .mockRejectedValueOnce(clientError("connection reset"))
      .mockResolvedValue("ok");

    await expect(
      runtime.read(
        { providerId: "postgresql", operation: "exportObjects" },
        action,
        () => true,
      ),
    ).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 10);
    expect(delay).toHaveBeenNthCalledWith(2, 20);
  });

  it("永久错误不重试并补充 Provider 诊断上下文", async () => {
    const delay = vi.fn();
    const runtime = new ProviderRuntime({ delay });
    const action = vi.fn().mockRejectedValue(clientError("password authentication failed"));

    await expect(
      runtime.read(
        { providerId: "postgresql", operation: "probeConnection" },
        action,
        () => false,
      ),
    ).rejects.toMatchObject({
      code: "DATABASE_CLIENT_FAILED",
      details: {
        providerId: "postgresql",
        operation: "probeConnection",
        attempt: 1,
      },
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
});

function clientError(detail: string): DataPullError {
  return new DataPullError("DATABASE_CLIENT_FAILED", "数据库客户端执行失败。", 1, {
    detail,
  });
}
