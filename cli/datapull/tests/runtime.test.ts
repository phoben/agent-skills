import { describe, expect, it } from "vitest";
import { DataPullError } from "../src/core/errors.js";
import { assertSupportedNode } from "../src/core/runtime.js";

describe("Node.js 版本门", () => {
  it.each(["22.12.0", "22.12.1", "23.0.0", "24.0.0"])("接受 %s", (version) => {
    expect(() => assertSupportedNode(version)).not.toThrow();
  });

  it.each(["20.19.0", "22.11.9", "21.99.0"])("拒绝 %s", (version) => {
    expect(() => assertSupportedNode(version)).toThrowError(DataPullError);
    try {
      assertSupportedNode(version);
    } catch (error) {
      expect(error).toMatchObject({ code: "NODE_VERSION_UNSUPPORTED", exitCode: 4 });
    }
  });
});
