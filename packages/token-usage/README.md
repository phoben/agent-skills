# Tokens 用量模块

YG Toolkit 的本地只读 MCP 服务和 C 版流量对照板。运行环境建议 Node24+、已登录的 Codex CLI；本期已在Windows/Codex0.163.0验证。

## 开发与验证

从仓库根目录执行：

```powershell
npm --prefix packages/token-usage ci
npm --prefix packages/token-usage test
npm --prefix packages/token-usage run build
npm --prefix packages/token-usage run verify:stdio
npm --prefix packages/token-usage run verify:live
```

`verify:live`通过构建后的真实MCP工具读取当前账号，仅输出计数、覆盖和守恒结果，不输出会话正文、认证信息或原始日志。

本机浏览器联调使用`npm --prefix packages/token-usage run preview`。该服务仅监听127.0.0.1:48765，带随机请求校验标记，通过与MCP相同的服务读取真实数据；正式插件不依赖它。

## 数据边界

- 官方账号汇总和额度经Codex App Server获取；服务不解析或保存登录令牌。
- 当前账号以官方accountId确认；本机creator_account_id缺失或属于其他账号时排除。
- Codex源SQLite以readOnly/query_only打开。JSONL和Zstandard日志只在当前Codex用户目录内流式读取。
- 缓存位于`CODEX_HOME/yg-toolkit/token-usage.sqlite`，只保存必要元数据和统计事件，与插件缓存分离。
- 支持显式Codex项目名、cwd回退及Git共同目录归组，多个worktree可汇总到同一项目。
- 日志累计快照取增量，重复快照不累计；子代理跳过继承部分并合并到同账号父会话。
- 缓存输入属于输入，推理属于输出。缓存+非缓存+输出等于合计；缓存写入归入非缓存输入。
- 官方日桶可能缺少当前日期或较早历史；页面显示部分覆盖，缺失值不补0。项目统计也不等同于官方账单。

## 分发

`plugins/yg-toolkit/plugin.json`为可移植清单，兼容清单保留在`.codex-plugin/plugin.json`。两者名称与版本必须相同。Codex0.163.0通过可移植配置展开`${PLUGIN_ROOT}`，不能仅验证直接stdio而忽略宿主加载。

构建生成自包含`token-usage.cjs`、内联`token-usage.html`和第三方许可。构建时解析内联脚本，避免模板替换破坏SDK中的特殊字符。包外stdio验证不依赖工作区node_modules或原型。

Windows中同版本缓存可能被运行中的MCP进程占用。可用`YG_TOKEN_BUILD_VERSION`先生成目标补丁版本的产物，再同步两份清单和包版本，最后安装；不覆盖运行中的同版本缓存。普通构建和版本自动化不设置该值。

接口和计数规则见`.trellis/spec/backend/token-usage.md`及任务设计。官方接口依据：[Codex App Server](https://learn.chatgpt.com/docs/app-server)、[Plugin Extensions](https://developers.openai.com/plugins/build/extensions)。
