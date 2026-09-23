# 发布机制与故障恢复

只在需要识别、执行或修复具体发布通道时读取。仓库自身的 manifest、脚本、工作流和发布文档始终优先于本参考。

## 路由

| 线索 | 首选入口 | 公开验证 |
|---|---|---|
| 标签触发的 GitHub Actions | 按 workflow 的标签模式创建新标签并监控对应 run | 发布页或目标 registry，加空缓存安装 |
| `package.json` 与 `prepublishOnly` | 先执行仓库发布前脚本，再使用既有 npm Trusted Publishing 或 `npm publish` | `npm view <包>@<版本>`、`dist-tags`、隔离 `npx` 或安装 |
| `pyproject.toml` 与构建配置 | 使用仓库已有 build/publish 工具和可信发布工作流 | PyPI JSON 元数据、隔离虚拟环境安装与导入 |
| GitHub Release 工作流 | 使用已有标签或 `gh release` 约定 | `gh release view`、附件校验和、下载 smoke test |
| 容器镜像工作流 | 使用仓库规定的 tag 与 registry 登录方式 | 查询不可变 digest，并从 registry 拉取后启动 smoke test |

找不到发布入口时，先从最近一次成功标签、CI 历史和仓库文档反推流程。不要临时发明与仓库并存的第二条发布通道。

## GitHub Actions

推送标签后通过 workflow 文件名和标签定位本次 run，持续观察到 `completed`。失败时读取失败 job 的完整日志，确认检出的提交、运行时版本、权限和发布目标。

OIDC 或 Trusted Publishing 失败时核对仓库、workflow 文件名、environment、`id-token: write`、托管 runner 和 registry 绑定。保持 2FA、签名与 provenance；认证配置需要账户所有者操作时，请用户完成该唯一外部步骤后续跑。

## Registry 语义

上传成功后 registry 可能仍在处理。日志已经显示接受制品时，轮询原始 registry 元数据并绕过本地缓存；不要再次发布相同版本。

registry 报告版本已存在时，将其视为不可变制品。比较已发布来源与本次目标：内容正确则转入验证，内容不同则生成新的后续版本，不能覆盖原版本。

稳定标签未更新时，在确认目标版本已公开后按仓库策略修正 dist-tag 或 channel，并再次从公开渠道安装。

## Git 与标签恢复

- 推送分支失败：获取远端并检查分叉，再选择安全的 merge 或 rebase；不使用 force 作为默认恢复。
- 标签与 manifest 不一致：本地未推送标签可以重建；远端标签的移动或删除必须得到用户单独确认。
- 标签已触发但发布失败：先修复失败原因。若制品尚未被 registry 接受，按仓库策略选择新提交与新版本；不要假设远端标签可以静默改写。
- 提交后发现漏项：补充提交并重新运行发布门。标签尚未创建时继续；标签已发布时使用新的后续版本。

## 验证隔离

优先在新临时目录、临时虚拟环境或专用缓存中安装公开制品。清理前解析并核对绝对路径位于预期临时根；保留版本、来源和 smoke test 输出作为验收证据，删除下载包、缓存和临时工程。
