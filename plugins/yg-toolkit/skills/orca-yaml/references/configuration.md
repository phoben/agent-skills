# orca.yaml 配置参考

本参考依据 2026-11-18 查看时的 [Orca 官方文档](https://github.com/stablyai/orca/blob/main/docs/site/content/docs/model/orca-yaml.mdx)。本机当时版本为 1.4.262；在线主分支可能与安装版本不同，下列内容不等同于对所有版本的实测保证。通常放在 Git 仓库根目录；文件夹工作区不执行 Git worktree 的复制和共享步骤。

## 顶层字段

全部可选。字符串会去除首尾空白；空值或过长值被丢弃。字段无效时通常跳过该字段，合法的同级字段仍可生效；未知字段不产生行为。

| 字段 | 类型与含义 | 省略时 |
| --- | --- | --- |
| `scripts.setup` | 非空脚本字符串；启用初始化时在新 worktree 中执行 | 无项目初始化脚本 |
| `scripts.archive` | 非空脚本字符串；启用 hook 时在归档或删除前执行 | 无项目归档脚本 |
| `setupAgentStartupPolicy` | `start-immediately` 或 `wait-for-setup` | `start-immediately` |
| `issueCommand` | 关联 GitHub/GitLab 事项的命令模板 | 无项目模板，可使用界面默认提示词 |
| `defaultTabs` | 对象列表，每项可包含 `title`、`command`、`color`，至少一个有效字段；颜色为 `#RGB` 或 `#RRGGBB` | 普通初始终端行为 |
| `worktree.sharedDirectories` | 相对仓库的目录路径列表，只共享主检出目录中已存在且被 Git 忽略的目录 | 仅使用个人设置中的共享路径 |
| `environmentRecipes` | 独立环境配方列表，见 [环境配方](environment-recipes.md) | 无项目配方 |

`scripts` 和 `worktree` 是映射，其余列表字段应为列表。`setupRunPolicy` 和 `commandSourcePolicy` 属于 Orca 的个人设置，不是 `orca.yaml` 字段。

```yaml
scripts:
  setup: |
    pnpm install
  archive: |
    echo Workspace archived
setupAgentStartupPolicy: wait-for-setup
defaultTabs:
  - title: Agent
  - title: Git status
    command: git status --short
    color: "#4A90E2"
worktree:
  sharedDirectories:
    - .cache
```

这是需要项目拥有 pnpm 且 `.cache` 已存在并被 Git 忽略的示例，应按项目和平台调整。

## 生效位置与顺序

主检出目录指在 Orca 中注册的仓库目录，可能与新 worktree 处于不同分支。

| 内容 | 读取位置 |
| --- | --- |
| 初始化脚本、启动策略、默认标签 | 新 worktree 的 `orca.yaml` |
| 共享目录规则及来源 | 主检出目录的 `orca.yaml` 和文件系统 |
| 复制规则及来源 | 主检出目录的 `.worktreeinclude` 和文件系统 |
| 归档脚本 | 主检出目录的 `orca.yaml`；在待归档 worktree 中执行 |
| 事项模板 | 主检出目录非空的 `.orca/issue-command` 优先，然后才是 `orca.yaml` |
| 环境配方 | 核对目标版本的官方文档及实际配置来源；不要假设使用新 worktree 的配置 |

初始化和终端默认值在创建时应用，不会持续同步已有工作区。个人设置的共享路径先应用，其次是 YAML 共享目录，最后才是 `.worktreeinclude` 复制；已有目标路径会保留。

## 脚本与启动

- 初始化是否执行受仓库设置、命令来源设置、审批及创建时的 `--setup run|skip|inherit` 影响。默认的新仓库设置为运行初始化。`wait-for-setup` 只调整 Agent 启动顺序；本地或 YAML 任一方要求等待时均会等待成功。
- 命令来源可设为仅 YAML、仅本地或两者都运行；两者都运行时 YAML 在前。未保存选择时，对某个 hook 有非空本地脚本则该 hook 默认仅本地，否则仅 YAML。共享目录独立于此选择。
- macOS/Linux 初始化 runner 使用 Bash 和 `set -e`。原生 Windows 默认使用 `.cmd`，逐个执行非空行并在失败时停止；选择 PowerShell 终端不会自动把脚本解释为 PowerShell。POSIX shebang 只有在 Git Bash 已配置且可用时才进入 Bash，否则会拒绝运行。PowerShell 脚本需要使用适合本机的显式调用方式。
- 初始化 runner 提供 `ORCA_ROOT_PATH`、`ORCA_WORKTREE_PATH`、`ORCA_WORKSPACE_NAME`；另有 `CONDUCTOR_ROOT_PATH`、`GHOSTX_ROOT_PATH` 兼容别名。`.cmd` 使用 `%ORCA_WORKTREE_PATH%`，Bash 使用 `$ORCA_WORKTREE_PATH`。
- CLI 删除工作区时需显式 `--run-hooks` 才执行归档脚本；失败通常阻止删除，除非调用方明确接受失败。

## 标签与事项

`defaultTabs` 创建时应用一次。桌面创建界面启动 Agent 时，Agent 占用第一个模板标签，该标签配置的命令不运行；本地 CLI 使用 `--agent` 时则另开启动终端。标签命令受初始化执行决定和命令来源限制，标题及颜色仍可应用。标签命令不等待 setup 完成，即使配置了 `wait-for-setup` 也不能推断其会等待；依赖安装的命令需自行处理顺序。

`issueCommand` 支持 `{{artifact_url}}` 和旧占位符 `{{issue}}`。创建界面决定是否使用模板；`.orca/issue-command` 的覆盖独立于 setup/archive 命令来源设置。

## 共享与复制

`worktree.sharedDirectories` 用于共享目录；不适合需要各工作区独立修改的数据。个人共享路径在 macOS 可使用 APFS 克隆复制，否则通常是链接；共享目录的具体结果应按目标版本和平台核对。链接会共享修改。

`.worktreeinclude` 是独立文件，用于复制被 Git 忽略的文件或目录，如 `.env`。支持空行和 `#` 注释，只接受具体路径；通配符、排除规则会被跳过并给出警告。不存在、被跟踪或未被忽略的路径不会复制。不要将实际秘密写入已跟踪的配置文件。

## 解析限制

无效 YAML、任意位置出现重复映射键、非映射根节点、过度别名展开或文件超限会使整个配置失效。普通 YAML 检查器即使接受重复键，也不能证明 Orca 接受。

| 限制 | 超限行为 |
| --- | --- |
| 文件 256 KiB UTF-8 且 262144 UTF-16 代码单元 | 整个文件被拒绝 |
| 每个字符串 64 KiB UTF-8 且 65536 UTF-16 代码单元，按修剪前计算 | 丢弃该字段 |
| `defaultTabs` 或 `environmentRecipes` 各最多 256 个输入项 | 超限时丢弃整个相应列表，配方会产生诊断 |
| `worktree.sharedDirectories` 前 100 个输入项 | 忽略后续项，前面无效或重复的项也计数 |
| YAML 解析器 `maxAliasCount` 为 100 | 超过展开预算则拒绝整个文件；并非简单计算别名个数 |
