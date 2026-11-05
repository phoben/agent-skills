# Tokens 页面规范

开发前读docs/design/token-usage.md与任务制品。保留C版矩阵与桑基逐行对齐，不重新探索布局。

- 生产无虚构数据、模拟成功或固定额度日期。
- 先App.connect再callServerTool，读取structuredContent，isError不得当成功。
- 日期、时区、分页与服务一致，以请求序号丢弃过期响应。
- 官方、本机分别表达加载、部分覆盖与失败，null不补0；额度按当前官方窗口。
- 会话有项目/范围、搜索排序分页、Tokens分项；关闭恢复焦点。
- 账号变化清除旧页与弹窗，输出转义，不传对话正文。
- 验证1440×1000与1280×800、日期与范围/单日、搜索排序和重试；浏览器与真实宿主分别记验收。

## 1. 适用范围

修改ui/的数据接入、筛选、矩阵、桑基或会话弹窗时使用。设计以docs/design/token-usage.md为准，页面自身不再重复宿主侧栏。

## 2. 签名

`await app.connect()`之后调用`app.callServerTool({name,arguments})`；生产只调用token_usage_dashboard与token_usage_sessions。入口token_usage_open由宿主注册global。

## 3. 契约

响应schemaVersion=1，dashboard为range/account/quota/local/sampledAt，sessions为project/range/date/totals/totalCount/filteredCount/sessions/page/pageSize/totalPages。identityKey变化时关闭旧弹窗并清空旧数据。quota.resetsAt为Unix秒，lastActivityAt与sampledAt为ISO时间。

预览仅在父服务注入window.__TOKEN_PREVIEW_TOKEN__时启用本机HTTP；正式HTML不包含该标记，不回退到模拟数据。

## 4. 校验与错误

| 条件 | 页面结果 |
| --- | --- |
| isError=true，即使带结构数据 | 显示错误，保留安全错误码 |
| null、字符串或负计数 | 显示未知，不当作0 |
| 官方缺失日期 | 折线断开，显示部分覆盖 |
| 本机totals=null或unavailable | 隐藏图表，不画伪零分布 |
| 旧请求晚于新请求完成 | 丢弃旧响应 |
| 账号变化 | 清空旧账号与会话 |

## 5. 正常、基础与失败场景

正常：点击日柱只查询该项目当日，会话日期与范围一致。基础：零用量正常显示，极小非零占比显示<0.1%。失败：搜索无结果保留范围合计并允许清除；连接失败保留重试入口。

## 6. 必需断言

model测试覆盖日期、空值、错误优先、额度选择、转义、趋势断线、微小占比与覆盖文案。实际桌面视口验证项目/桑基源逐行对应，类型占比极不均衡时标签仍可读；真实服务验证日期、搜索排序、范围/单日和焦点恢复。

## 7. 错误与正确做法

错误：固定五行高度、固定额度日期，或把日桶缺口补0画成连续趋势。

正确：按真实行边界定位桑基、按官方窗口格式化重置时间，仅连接连续有效日期。内联页面产物要实际运行后再交付。

## 顶部卡片、主题与项目折叠

- 统计项放顶部四张卡片，不再在底部重复。Tokens构成为缓存/非缓存/输出环图，额度为真实窗口圆形进度；保留官方与本机口径区别。
- App初始化后读取getHostContext，订阅onhostcontextchanged。宿主主题优先，未提供时跟随prefers-color-scheme；样式变量同主题按键合并，换主题清除上一主题残留。
- 暗色页面映射宿主color-background-primary，卡片、悬停、边框和轨道根据该背景与文字混合派生；禁止直接将secondary作为画布、primary作为卡片，避免宿主深浅层级与页面相反。显式暗色和系统回退须一致，并实际注入宿主primary=#111、secondary=#303030检查。浅色色板不随暗色精修改变。
- projectPresentation按全量本机totalTokens严格比较>1%；<=1%聚为group:other，保留memberIds，分项/日桶/会话数相加，未知不冒充零。展开后恢复原项目，不重新归一化百分比。
- 合并行通过projectIds调用会话接口，不把group:other作为真实projectId发送。
- day-cell与day-hit均明确底部对齐，day-hit为row方向；截图之外实际测量非零bar的bottom坐标差应小于0.5px。

底部统计覆盖用指标卡展示。本机记录数来自索引和日志读取情况，官方覆盖用所选区间已返回天数及区间总天数，历史起止日期单独标示。真实零照常展示，缺失计数用破折号，独立错误保留可见。每张卡的口径提示支持悬停、键盘聚焦和 Escape 关闭。
