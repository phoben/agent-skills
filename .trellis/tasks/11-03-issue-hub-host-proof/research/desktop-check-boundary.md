# 真实桌面点检边界

日期：2026-11-03。

已完成的独立只读探测见 [目录计数](independent-catalog.json)：项目接口返回 22 个项目、25 个 root，当前直接仓库探测识别 11 个 GitHub 仓库。12 个 root 未按直接仓库读通，2 个未发现 GitHub remote，因此整体为 partial，尚未与桌面完整列表逐项对照。另已执行新宿主适配的 identity 方法，确认可得到身份键，未输出身份值。

没有进行 Codex UI 自动化、没有创建或发送聊天、没有写入 GitHub，真实宿主验收仍为待点检。

本机 Windows Computer Use 技能 `C:/Users/NINGMEI/.codex/plugins/cache/openai-bundled/computer-use/26.623.141536/skills/computer-use/SKILL.md` 的 Windows Safety 明确要求：

> Do not automate the Codex desktop app UI or Codex CLI or Codex extensions within Windows apps

该限制针对 Windows UI 操作；本阶段允许通过普通终端执行受限、只读 CLI/MCP 协议验证。不能为了获得截图和点击结果而改用 SendKeys、直接 UIA、私有 CDP 或程序注入绕过限制，也不能称作工具不存在或连接失败。

后续先交付可运行包、包外测试和最短用户点检步骤。原生侧栏呈现、工作区草稿、成员发送后的确定性关联与返回已有聊天，应由用户在真实 Codex 中操作并反馈，记录所见结果，不用模拟或源码证明替代。
