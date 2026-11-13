# Research: 私有 GitHub Issue 附件认证读取

- Query: 在不向前端发送 gh 凭据、不建立任意 URL 代理的前提下，读取用户指定私有 Issue 的图片。
- Scope: mixed，本机已安装 gh 的受限只读实测与 GitHub CLI 官方固定版本源码。
- Date: 2026-11-05

## Findings

### 当前四张图片可用的真实路径

根代理已验证仓库为private、四个原始附件URL匿名HEAD均404，渲染器则把HTML img转义（image-preview-probe.json）。本研究用当前gh登录对同四张图片逐个GET，全部成功。

固定命令形状为：

```text
gh api --hostname github.com --method GET --include -H "Accept: application/octet-stream" https://github.com/user-attachments/assets/<uuid>
```

这里是 **github.com 原附件URL**，不是api.github.com的REST路径。试图读取 `/user-attachments/assets/<uuid>` 的API路径得到404。`Accept: image/*`与octet-stream在第一张图返回相同PNG及SHA。

Node调用必须 `shell:false`、`windowsHide:true`、`encoding:'buffer'`；先在内存中剥离HTTP头，再使用实际二进制payload，不能复用当前JSON客户端UTF8 stdout解析路径。探针maxBuffer为5MiB或8MiB，timeout20秒；异常没有打印stderr/响应头/临时签名URL。

| 图片顺序 | HTTP | MIME | PNG魔数 | payload字节 |
| --- | --- | --- | --- | --- |
| 1 | 200 | image/png | 正确 | 194738 |
| 2 | 200 | image/png | 正确 | 151748 |
| 3 | 200 | image/png | 正确 | 129891 |
| 4 | 200 | image/png | 正确 | 53102 |

原始结果仅保存状态、MIME、大小与SHA，无图片像素或正文：image-auth-probe.json、image-auth-all-probe.json。没有下载到磁盘、改GitHub、变更配置或操作聊天。

### 认证与重定向

已安装版本为GitHub CLI 2.85.0。读取其官方固定tag源码：

- https://github.com/cli/cli/blob/v2.85.0/api/http_client.go
- https://github.com/cli/cli/blob/v2.85.0/go.mod

`NewHTTPClient`在`api/http_client.go:30–68`先用无效host/token阻止底层自行解析凭据，再加CLI的认证RoundTripper。`AddAuthTokenHeader`在`:91–111`按请求host取得ActiveToken；若重定向的host与上一请求host不同，不再添加认证头。`go.mod:18`固定go-gh/v2 v2.13.0。

本地保存的公开源码分别为gh-2.85-api-http_client.go.txt和gh-2.85-go.mod.txt。这里仅依据官方源码说明跨host不会重新添加token；没有抓取或持久化真实敏感请求头，不声称逐跳抓包复验。gh会自动跟随附件重定向，当前CLI没有本研究已验证的“返回最终host并由调用方逐跳批准”开关，初始地址必须严格限制为GitHub自己的附件路径。

### 推荐实现边界

1. 增加专用只读媒体读取能力，不能放宽通用GitHub REST `request`的路径白名单。初始认证地址仅接受`https://github.com/user-attachments/assets/<标准uuid>`，默认443，无userinfo/query/hash，不接受任意https链接。
2. 媒体请求先验证当前GitHub身份、expectedIdentity、当前仓库权限与Issue归属；URL必须确实出现在本次Issue正文或某条已校验属于该Issue的评论中。只有host白名单不够，不能让前端直接拿任意私有附件UUID做代理读取。
3. 下载前后按现有guard复核当前凭据/账号。失权不能因缓存或迟到结果复活旧图片。前端也要检查账号/仓库/Issue代次与元素仍连接，切换后丢弃旧结果。
4. 原始token只由gh在服务端使用。前端获得经MIME和魔数校验的受限data URL或Blob图片，不得获得Authorization或临时签名CDN URL。SVG/HTML等主动格式建议首版不作内联，保留原链接。
5. 明确最大payload（例如5MiB）、超时和并发数。base64有4/3扩展，5MiB会约6.7MiB，要核对宿主消息上限；不能在下载后才对无界stdout限量。gh进程maxBuffer可在超限时终止本次读取。
6. 不建议持久化完整图片到SQLite。若加内存复用，必须按账号/仓库/Issue隔离并处理失权清除；不缓存也应避免未变化DOM重复加载，使用懒加载与失效清理。
7. 图片失败单独显示降级链接，不要把一张私有图片读取失败等同整个Issue离线，更不能遮掉已读正文/草稿。当前真实GitHub身份失败仍沿用账号保护。

## Files Found / Code Patterns

- `packages/issue-hub/src/github/client.mjs:7`：当前execFile固定utf8，只适合现有JSON路径；媒体需要独立buffer执行器或明确binary分支。
- `packages/issue-hub/src/github/client.mjs:43`：凭据仅进程内取散列，不返回原token，应继续保持。
- `packages/issue-hub/src/github/client.mjs:51`：当前通用REST路径白名单不可直接改成任意绝对URL。
- `packages/issue-hub/src/services/issues.mjs:70`：guard复核凭据/已验证账号，媒体读取前后应复用。
- `packages/issue-hub/src/services/issues.mjs:114,147`：仓库元信息、目录与权限解析入口。
- `packages/issue-hub/src/services/issues.mjs:221`：rawIssue读取，应作为正文图片归属的来源；评论图片需另验证真实父Issue，不能只信前端commentId。
- `packages/issue-hub/src/services/issues.mjs:36`：附件当前只是URL集合，与媒体内容读取不同。

## Related Specs

- `.trellis/spec/backend/issue-hub.md`：账号作用域、权限撤销、缓存归属和guard。
- `.trellis/spec/frontend/issue-hub.md`：当前HTML转义/图片链接化策略需要按用户新要求更新；不等于开放任意HTML。
- agent-reach的GitHub CLI后端与references/dev.md用于本次只读平台访问。

## Caveats / Not Found

- 尚未验证前端data/blob在真实Codex宿主CSP下的加载策略，需独立按已安装MCP Apps SDK及宿主资源元数据确认；不能只加img标签或仅放开github.com域。
- 本研究认证实测仅覆盖用户指定的四张PNG，不保证任意user-images/private-user-images或其他外部CDN。尤其不可把gh凭据用于未知host。
- 已证实的API路径404不得当作下载不存在；原URL认证GET才是本次可用路径。
- 不构建通用任意URL图片代理；不把未完成的comment分页或未验证的外部URL当作拥有权证据。
- 研究文件仅在任务research目录，未改业务、spec、Git或真实用户配置。
