# 独立插件分发与升版兼容调查

日期：2026-11-03。只读核查，没有构建、提交、推送或修改钩子。

## 名称与分发

- 当前仓库不存在 `packages/issue-hub`、`plugins/issue-hub`，排除本轮规划文档后无同名入口；仅证明本仓库可用。
- `.agents/plugins/marketplace.json:2` 的 market 名为 yg，第 6 行为插件数组。按既有 local source 结构可新增独立 `issue-hub` 条目指向 `./plugins/issue-hub`，无需第二个 marketplace。
- 用户已选择成员预装 Node 24、Git、gh、Codex，首版不捆绑运行时。

## 升版钩子的当前范围

- `.codex/hooks/bump_plugin_version_before_push.py:11` 硬编码 YG 双清单、Tokens 构建和产物；第 130 行提交 scope 固定 yg-toolkit；第 149–177 行只比较 YG 当前与 upstream 版本。
- 直接新增插件后，钩子可能为仅 Issue Hub 的变更错误升级 YG；YG 已升版时则提前返回，不检查 Issue Hub。
- 现有逻辑没有 upstream 不存在新插件时的首次发布分支。
- `.codex/hooks.json:6` 的工具匹配与 `docs/adr/0009-auto-bump-plugin-version-before-codex-push.md:22` 限定了触发范围，不能保证所有 Git 客户端或工具都自动执行。

## 实施要求

1. 注册每个插件的身份、双清单、源归属、构建命令和允许提交产物；明确共享文件归属。
2. 只对实际受影响插件执行版本比较与必要升版，支持首次发布。
3. 保留干净目标预检、失败局部恢复、重试幂等及不碰其他工作区变更。
4. 在 `.codex/hooks/test_bump_plugin_version.py:80` 现有临时仓库测试基础上，覆盖仅 Issue Hub、仅 YG、两者、新插件首次发布、构建失败和重试。
5. 实际 Codex 工具是否触发受信任 hook 需要单独验收；不在规划阶段修改安装或运行真实 push。
