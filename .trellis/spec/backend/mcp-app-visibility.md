# YG页面工具可见性（0.3.5）

## 1. 范围与触发

用户明确要求将原模型可见的token_usage_open、issue-repositories、issue-read及issue-comments改为仅页面可见，并保留侧边栏和页面。此约定覆盖旧规范中Issue三个模型只读工具的要求。修改任一正式MCP工具注册、验证或可见性时读取。

## 2. 签名

保留12个工具的名称、参数、处理函数与资源URI。Tokens三工具及Issue九工具均配置`_meta.ui.visibility=['app']`，并关联各自resourceUri。两个global仍分别为token_usage_open及issue-hub-open。

## 3. 契约

- `openai/ui.entrypoints=[{type:'global'}]`与visibility是不同维度；仅隐藏模型发现，不删除global或资源。
- 无visibility字段时不能认为已隐藏；正式工具全部显式声明仅app。模型集合按visibility含model或缺省推导，此版本期望0。
- raw tools/list和宿主MCP状态仍有12项，供页面与诊断查询；不能将raw总数当模型可见数量。
- 页面原工具调用、统计/Issue逻辑、身份/权限/写入及数据存储保持。可见性不是新业务授权或删除实现。
- 当前对话已包含的历史工具描述不会追溯清除；不承诺未经实际测量的token节省比例。

## 4. 校验与错误

| 情况 | 结果 |
| --- | --- |
| 任一正式工具visibility缺失或含model | 可见性回归失败 |
| raw tools仍12且都app-only | 正常，模型集合为空 |
| 隐藏工具同时删掉global或资源 | 功能回归失败 |
| app调用返回业务错误 | 沿用原安全错误处理，不绕过身份/权限 |

## 5. 正常、基础与失败场景

正常：两个侧栏入口打开原页面并调用原工具。基础：模型不发现这些MCP接口，相关技能可使用其他GitHub连接器或gh。失败：gh缺失只限制Issue，不阻断Tokens入口；隐藏不等于伪造成功数据。

## 6. 必须验证

内存协议核对全visibility/global/resource及原handler可调用，Tokens用fake service覆盖open/dashboard/sessions，Issue保留读取/评论分页断言。两包完整测试与包外协议核对12 raw/0 model/2 global；真实安装后确认元数据、资源可读及文件哈希。若未自动操作原生UI则不声称原生页面点击已验收。

## 7. 错误与正确做法

错误：只隐藏入口而留下读取工具，或为减少模型工具删除页面后台接口；将raw目录的12项误报为模型仍暴露12项。

正确：四项补齐app-only，全12项一致验证；侧栏和页面继续使用原资源及工具。
