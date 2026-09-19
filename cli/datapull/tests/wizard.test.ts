import { checkbox, confirm, select } from "@inquirer/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { promptSkillSetup } from "../src/interactive/wizard.js";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
}));

describe("首次运行 Skill 安装向导", () => {
  beforeEach(() => {
    vi.mocked(confirm).mockReset();
    vi.mocked(select).mockReset();
    vi.mocked(checkbox).mockReset();
  });

  it("不检测本机 Agent，并默认勾选 Codex", async () => {
    vi.mocked(confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(checkbox).mockResolvedValueOnce(["codex"]);
    vi.mocked(select).mockResolvedValueOnce("user");
    const write = vi.fn().mockResolvedValue(undefined);
    const store = {
      read: vi.fn().mockResolvedValue({ onboarding: { skillPrompted: false } }),
      write,
    };

    await promptSkillSetup(store as never, { projectRoot: "C:\\workspace" });

    expect(checkbox).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "选择 Agent 工具（不检测本机是否已安装）：",
        required: true,
        choices: expect.arrayContaining([
          expect.objectContaining({ value: "codex", checked: true }),
        ]),
      }),
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Codex 的安装位置：",
        default: "user",
        choices: [
          { name: "用户级 · 所有项目可用", value: "user" },
          { name: "项目级 · 仅当前项目", value: "project" },
        ],
      }),
    );
    expect(write).toHaveBeenCalledWith({ onboarding: { skillPrompted: true } });
  });

  it("为每个选中的 Agent 分别单选一个安装位置", async () => {
    vi.mocked(confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(checkbox).mockResolvedValueOnce(["codex", "claude"]);
    vi.mocked(select).mockResolvedValueOnce("project").mockResolvedValueOnce("user");
    const write = vi.fn().mockResolvedValue(undefined);
    const store = {
      read: vi.fn().mockResolvedValue({ onboarding: { skillPrompted: false } }),
      write,
    };

    await promptSkillSetup(store as never, { projectRoot: "C:\\workspace" });

    expect(select).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: "Codex 的安装位置：",
      }),
    );
    expect(select).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: "Claude Code 的安装位置：",
      }),
    );
    expect(write).toHaveBeenCalledWith({ onboarding: { skillPrompted: true } });
  });
});
