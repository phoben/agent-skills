import { checkbox, select } from "@inquirer/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { promptObjectTypes } from "../src/interactive/object-selection.js";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  select: vi.fn(),
}));

describe("数据库对象拉取范围", () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
    vi.mocked(checkbox).mockReset();
  });

  it.each([
    ["all", ["table", "view", "function", "procedure", "trigger", "event"]],
    ["common", ["table", "view", "function", "procedure"]],
    ["advanced", ["trigger", "event"]],
  ] as const)("选择 %s 时直接返回对应范围", async (scope, expected) => {
    vi.mocked(select).mockResolvedValueOnce(scope);

    await expect(promptObjectTypes("mysql")).resolves.toEqual(expected);
    expect(select).toHaveBeenCalledWith({
      message: "选择数据库对象拉取范围：",
      default: "common",
      loop: false,
      choices: [
        { name: "全部对象", value: "all" },
        { name: "常用对象", value: "common" },
        { name: "高级对象", value: "advanced" },
        { name: "自定义", value: "custom" },
      ],
    });
    expect(checkbox).not.toHaveBeenCalled();
  });

  it("只有自定义范围展示完整且不循环的中文多选列表", async () => {
    vi.mocked(select).mockResolvedValueOnce("custom");
    vi.mocked(checkbox).mockResolvedValueOnce(["table", "view", "function"]);

    await expect(promptObjectTypes("postgresql")).resolves.toEqual([
      "table",
      "view",
      "function",
    ]);
    expect(checkbox).toHaveBeenCalledWith({
      message: "选择要拉取的数据库对象：",
      required: true,
      loop: false,
      pageSize: 10,
      choices: [
        { name: "模式(Schema)", value: "schema", checked: false },
        { name: "扩展(Extension)", value: "extension", checked: false },
        { name: "数据表(Table)", value: "table", checked: true },
        { name: "视图(View)", value: "view", checked: true },
        {
          name: "物化视图(Materialized View)",
          value: "materialized_view",
          checked: false,
        },
        { name: "序列(Sequence)", value: "sequence", checked: false },
        { name: "函数(Function)", value: "function", checked: true },
        { name: "存储过程(Procedure)", value: "procedure", checked: false },
        { name: "触发器(Trigger)", value: "trigger", checked: false },
        { name: "类型(Type)", value: "type", checked: false },
      ],
    });
  });
});
