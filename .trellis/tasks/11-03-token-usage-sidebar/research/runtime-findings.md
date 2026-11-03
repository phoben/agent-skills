# 运行时证据

2026-11-03：Node24.19.0、Codex CLI0.163.0、Trellis0.6.17。

账号App Server只读调用成功，返回每日桶；accountId可匹配本机线程。当前索引未提供显式project_id，部分历史缺少creator_account_id。日志有timestamp/ordinal/type/payload，子代理最前的自身meta之后可能出现复制父meta；subagent_history_start_ordinal是第一条新增记录，不能丢弃边界本身。首次累计大于last时保守统计并标部分覆盖。

官方依据：https://learn.chatgpt.com/docs/app-server 、https://developers.openai.com/plugins/build/extensions 。global入口为ui.resourceUri与openai/ui.entrypoints配置。

仓库无CodeGraph，已初始化Trellis并保留既有AGENTS与hooks.json。
