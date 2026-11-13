# 多插件升版钩子实施结果

2026-11-04，trellis-implement 接续 P5；仅修改钩子、测试和原 ADR，未在真实仓库执行提交或推送。

## 行为

- 用 `PLUGINS` 明确登记 YG Toolkit 与 Issue Hub 的双清单、源归属、构建入口和允许产物。Issue Hub 正式产物为 `issue-hub.cjs`、`app.html` 与许可，不包含旧 P0 host-proof.html。
- 仅根据 upstream..HEAD 的已提交差异升版，空推送和普通文档不升版。路径以 NUL 分隔，中文路径不受 Git 引号影响。marketplace 按具体插件条目比较，其他插件条目不受牵连。
- 所有受影响插件先完成干净目标、符号链接、构建输入检查，再改写任何版本目标。构建输入未提交时拒绝重建，避免将其他会话代码打入产物。
- 两个插件同改时，全部重建成功后统一创建一个独立中文版本提交；构建/提交失败恢复本轮所有版本目标与索引，保留其他暂存和未暂存内容。
- upstream 没有新插件时按首次发布校验，保留初始版本，不给 YG 补升版。Issue Hub 要求已提交双清单、构建入口及全部产物，CJS/HTML 首行 `Issue Hub 版本: x.y.z` 必须精确匹配清单。比远端更低的版本拒绝处理。
- 保留 dry-run 不变更、无 upstream 拒绝、失败后重试不重复升版，以及旧 YG 单清单/无构建兼容。

## 验证

`python -m unittest discover -s .codex/hooks -p test_bump_plugin_version.py`：最终 23 项完整测试通过（48.145 秒），全部只用临时仓库、本机 Node 和本地 bare 远端。覆盖 Issue-only、YG-only、两者、marketplace 独立条目、首次发布及双清单/产物旧版/缺失、中文路径、全量预检、第二插件构建失败恢复、提交失败、其他暂存保留、重试、dirty/ignored/untracked 产物与未提交构建输入。

补充 Issue Hub 双清单必须同时存在后，先跑 first_release 三项定向测试通过，再执行上述最终全量；`py_compile` 和限定文件 `git diff --check` 通过。没有用真实推送去验证 Codex hook 是否受信任或工具是否触发；这一已有宿主限制仍保留在 ADR。

## 文件

- `.codex/hooks/bump_plugin_version_before_push.py`
- `.codex/hooks/test_bump_plugin_version.py`
- `docs/adr/0009-auto-bump-plugin-version-before-codex-push.md`

构建版本头部由 root 的 Issue Hub 构建器提供。本钩子不读取凭据、不安装依赖、不改变 DataPull NPM 版本，也不自行触发推送。
