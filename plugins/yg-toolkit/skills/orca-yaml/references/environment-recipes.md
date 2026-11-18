# 独立环境配方

本参考依据本机 Orca 1.4.262 自带的 `orca skills get orca-per-workspace-env`，查询日期为 2026-11-18。目标版本如有差异，以该版本内置指南、`orca vm recipe doctor --help` 和[官方指南](https://github.com/stablyai/orca/blob/main/skill-guides/orca-per-workspace-env.md)为准。

`environmentRecipes` 描述每个工作区的独立环境，例如 VM、SSH 主机或容器。Orca 调用配方中的本地命令，具体资源创建、连接和清理由脚本负责；写入 YAML 本身不会实现这些功能。

```yaml
environmentRecipes:
  - id: example
    name: Example Environment
    create: ./scripts/orca-vm/create.sh
    suspend: ./scripts/orca-vm/suspend.sh
    resume: ./scripts/orca-vm/resume.sh
    destroy: ./scripts/orca-vm/destroy.sh
    timeoutSeconds:
      create: 1800
      destroy: 120
    passEnv: [GH_TOKEN, GITHUB_TOKEN, 'CLOUDSDK_*']
```

示例仅展示结构，脚本必须存在、适配本地系统并满足 Orca 约定；Windows 不应假设能直接执行 `.sh`，按本机内置 Windows 指南选择可运行的启动方式。

| 字段 | 说明 |
| --- | --- |
| `id`、`name` | 配方标识和显示名称 |
| `create` | 必需；从仓库根目录在本地执行，stdout 输出一个结果 JSON 对象 |
| `suspend`、`resume` | 可选且须成对配置；从 stdin 读取生命周期数据，恢复时输出新的结果 JSON |
| `destroy` | 销毁命令；明确无自动销毁时写 `none`，资源需要另行清理 |
| `timeoutSeconds` | 单个整数或按生命周期步骤指定，范围 1–86400 秒；默认无限制，非法值会产生诊断并保持无限制 |
| `passEnv` | 允许传递的精确环境变量名或以 `*` 结尾的前缀；省略时继承 Orca 的环境。基础变量和 Orca 配方变量始终保留，错误配置会产生诊断并限制为基础变量 |
| `checkoutMode` | `provisioned-root` 仅适用于指定的直接 SSH 场景，须满足版本 2 的结果协议 |

旧字段 `command` 和 `cleanup` 分别兼容 `create` 和 `destroy`。结果对象的普通 Orca server 模式包括 `pairingCode` 和远端绝对路径 `projectRoot`，可包含 `schemaVersion: 1` 和 `userData`。SSH 模式及 `provisioned-root` 的结果结构不同，实施前读取目标版本内置 SSH 参考，不要套用普通模式。`userData` 不存放秘密。

检查分为不同层次：

```powershell
orca vm recipe doctor <配方ID> --repo-path <仓库路径> --json
orca vm env doctor --json
```

前者检查配方和脚本路径等静态条件，不启动资源；后者在目标环境中检查工具和环境。逐项检查 `fail` 与 `warn`，不能仅凭 `ok` 判定无问题。`--provision` / `--connect` 会实际创建并尝试销毁资源，可能产生费用；`--run-setup` 会重新执行初始化脚本。不要在用户仅要求解释或静态检查时运行这些动作。
