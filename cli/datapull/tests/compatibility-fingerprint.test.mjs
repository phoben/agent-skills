import { describe, expect, it } from "vitest";
import { normalizeCompatibilityContent } from "../scripts/compatibility-fingerprint.mjs";

describe("兼容性指纹内容归一化", () => {
  it("不同操作系统的换行符得到相同内容", () => {
    const expected = "第一行\n第二行\n第三行\n";

    expect(normalizeCompatibilityContent("第一行\r\n第二行\r第三行\r\n")).toBe(expected);
    expect(normalizeCompatibilityContent(expected)).toBe(expected);
  });
});
