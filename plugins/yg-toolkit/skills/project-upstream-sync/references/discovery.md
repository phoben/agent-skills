# 发现与基线

## 1. 固定本地状态

运行 `git status --short --branch`、`git branch --show-current` 和 `git remote -v`。记录同步前状态；与本次同步无关的脏文件属于他者占用区，不修改、不暂存、不清理。

完成标准：当前分支、跟踪关系、脏文件和可用远端都已明确。

## 2. 读取同步配置

读取 `.framework-sync.json`，以其中的真实值为准：

- `upstream.remote`：远端名称，可能是 `framework`，不能硬编码为 `upstream`。
- `upstream.url`、`upstream.branch`：远端地址和目标分支。
- `lastCommit`：上次已处理到的连续基线。
- `retainedProjects`、`identifierMap`：保留模块和标识符适配。

配置缺失或字段矛盾时，只报告缺口并请用户确认；不能从目录名、当前应用标识符或远端默认分支反推历史基线。新增/修改 remote、首次基线和凭据都需要明确授权。

完成标准：远端、分支、基线和项目适配信息相互一致。

## 3. 刷新并验证候选范围

只读检查可使用：

```powershell
git fetch <remote> <branch>
git cat-file -e "<lastCommit>^{commit}"
git merge-base --is-ancestor <lastCommit> <remote>/<branch>
git log --date-order --oneline <lastCommit>..<remote>/<branch>
```

若基线不存在、上游改写历史或 ancestry 检查失败，停止自动范围判断并报告，不擅自重置基线。候选很多时按时间或模块分批，但提交类型不能替代 diff 审查，也不能因数量大而自动忽略安全、兼容或 Harness 变更。

完成标准：候选提交集合有明确起止点，0 个候选时直接报告已经同步。
