# Issue详情失败与离线提示：只读诊断

用户在YG Toolkit 0.3.0中查看phoben/aoy-erp #185，列表已有47条缓存，详情提示“暂时无法连接GitHub”，页面同时显示离线缓存。本报告先记录代码事实与可证伪假设；没有把推测当根因，没有操作真实数据库、插件配置或聊天。

## 三个候选原因

1. 桌面启动的gh进程继承代理环境与登录Shell不同。若成立，同一GET在login true成功、login false或GUI等效环境失败，安全错误分类能看到代理/DNS/TLS/超时差异。
2. 某一真实GET失败或超时，包括身份、仓库元数据及Issue详情。若成立，逐端点读取可定位失败阶段；列表存在只说明历史缓存可用，不能证明这轮联网成功。
3. 本地gh执行/响应解析失败被归为通用NETWORK_UNAVAILABLE。若成立，退出码、超时/缓冲标记和是否取得HTTP状态能够区分，不能只凭UI文案认定电脑断网。

真实gh、安装缓存MCP、login与代理对照由主会话进行，本报告不争用这些进程。

## 已核对的实际路径

- `src/github/client.mjs`只调用固定github.com REST，无shell。GET在没有可解析HTTP响应或HTTP 5xx时统一NETWORK_UNAVAILABLE；HTTP401/403/404/限流分别有明确分类。当前不会把原始stderr或token回传页面。
- `services/issues.mjs`的`context()`只允许同凭据散列对应的已验证身份离线读取。凭据未知、变化或401不能读取旧私有缓存。
- `cached()`只有对应kind/key存在才回退。列表页保存在page，`read-summary`正文走单独issue-raw。此前没有读过的Issue，列表能显示不代表已有可用详情缓存。
- 如果身份在线验证成功，详情GET失败且issue-raw不存在，服务原样抛NETWORK_UNAVAILABLE。如果身份本轮已失败而进入可信离线模式，没有详情缓存则OFFLINE_UNCACHED。两种路径都不能伪造完整详情。
- `LiveStore.request()`读取明确offline，或在NETWORK/UNAVAILABLE/TIMEOUT/RATE_LIMIT错误时置online=false。HOST_/CATALOG_已排除；单纯cached不会视为离线。
- UI详情只消费read-summary/read成功投影，不把列表显示当作已成功读取正文，因此会出现“列表缓存仍在，但详情失败”。

因此截图组合与真实网络失败的正常传播一致；尚无证据认定“离线缓存”是误报。

## 可用反馈seam

- `createGithubClient({run,timeout})`：可确定性注入真实已捕获的执行结果，断言安全分类；可以分别覆盖有HTTP响应和无响应。
- IssueService现有setup：可先写列表缓存，再只让详情GET失败，验证列表保留、无详情缓存时不伪造正文；也可区分身份GET与详情GET失败。
- `LiveStore`注入call：可以断言对应安全错误才改联网状态，成功query带联网证据才恢复，不让任务成功冒充GitHub恢复。

应先取得主会话真实探针的失败形状，再在正确seam写准确红回归。只生成任意网络错误无法证明当前问题的具体原因。

## 已运行检查

```text
node --test --test-name-pattern=离线 test/issues-product.test.mjs
tests 3 / pass 3 / fail 0
```

覆盖本机草稿离线恢复不自动发布、失权后不读旧私有缓存、资源401撤销离线映射。这些是既有契约检查，不冒充本次真实桌面故障复现。

## 待定边界

当前没有修改业务文件、测试或系统代理。等待真实探针和主会话分配最小变更范围；纯环境故障应修复明确环境，不删除缓存/弱化身份保护。若是代码问题，在指定clean worktree写先红后绿回归，再交独立检查。
