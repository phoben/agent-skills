# 通过 NPM Trusted Publishing 发布 DataPull

## 状态

已采纳。

## 背景

DataPull 是公开 NPM 包，并启用了发布双因素认证。`npm login` 只能建立当前终端会话，手工
`npm publish` 仍会要求逐次认证；CLI 生成的网页认证链接还可能在原进程退出后失效。把长期写
Token 保存为 GitHub Secret 虽然能够自动化，但会引入泄露、轮换和权限过宽风险。

## 决策

- 使用 NPM Trusted Publishing，将 `@yg-toolkit/datapull` 绑定到
  `phoben/agent-skills` 的 `.github/workflows/datapull-publish.yml`。
- 仅允许 GitHub 托管运行器通过 OIDC 发布；工作流只授予 `contents: read` 与
  `id-token: write`。
- 使用 `datapull-v*` 标签触发，并在上传前校验标签版本与 `package.json` 完全一致。
- 使用满足 NPM OIDC 要求的 Node.js 24 与 npm 11.5.1，不配置长期 `NPM_TOKEN`。
- 允许受信任工作流直接执行 `npm publish`，发布后同时验证 registry `latest` 和空目录执行结果。

## 结果

- 常规发布不再需要维护者登录 NPM 或逐次操作通行密钥，并自动生成来源证明。
- NPM 中的仓库、工作流文件名和 Environment 与 GitHub 工作流形成不可随意改变的发布契约。
- 工作流重命名、仓库迁移或引入 GitHub Environment 时，必须同步重建 NPM Trusted Publisher。
- 手工发布仍受 2FA 保护，但只作为故障处理路径，不能成为正常发布方式。
- 发布成功日志与 registry 可用性是两个阶段；NPM 处理期间不得重复发布同一版本。
