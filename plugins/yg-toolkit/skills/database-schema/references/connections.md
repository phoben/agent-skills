# 连接配置

运行数据固定存放在当前项目根目录的 `.database-schema/`：

```text
.database-schema/
├── .gitignore
├── connections.json
├── last-run.json
└── schemas/
    └── <连接别名>/
        └── <数据库名>/
            ├── manifest.json
            ├── table/
            ├── view/
            ├── function/
            └── ...
```

Git 项目以 `git rev-parse --show-toplevel` 返回的位置为根目录；非 Git 项目使用当前工作目录。不得增加自定义存储路径参数。

## 初始化

在目标项目根目录执行：

```bash
python <skill目录>/scripts/export_schema.py --init
```

命令从 Skill 内置模板创建 `connections.json`，且不会覆盖已有配置。`.database-schema/.gitignore` 默认排除连接配置、临时目录和运行报告，但保留 `schemas/` 中的结构快照供项目自行决定是否纳入版本控制。

## 字段

每个连接支持以下公共字段：

| 字段 | 含义 |
| --- | --- |
| `enabled` | 是否允许该连接被选择 |
| `alias` | 唯一连接别名，也是快照的第一级目录名 |
| `engine` | `mysql`、`postgresql` 或 `sqlserver` |
| `urlEnv` | 保存完整连接 URL 的环境变量名 |
| `host` / `hostEnv` | 主机直写值或变量名，二选一 |
| `port` / `portEnv` | 端口直写值或变量名，二选一 |
| `username` / `usernameEnv` | 用户名直写值或变量名，二选一 |
| `passwordEnv` | 密码变量名；禁止 `password` 明文字段 |
| `sslMode` / `sslModeEnv` | MySQL 或 PostgreSQL 客户端 SSL 模式 |
| `timeoutSeconds` | 连接预检和普通 CLI 命令超时秒数，默认 120；SQL Server 完整 SMO 导出至少允许 900 秒 |

SQL Server 还支持 `authentication: "integrated"`、`encrypt` 和 `trustServerCertificate`。使用集成认证时不需要用户名和密码变量。SQL Server 的安全默认值为 `encrypt: true`、`trustServerCertificate: false`：传输加密且验证服务器证书。即使配置省略 `encrypt`，脚本也按 `true` 处理。

`trustServerCertificate: true` 仍会加密传输，但不验证服务器身份，只适合用户明确批准的本地、开发、受控内网或临时诊断场景。正式、生产或公网连接应使用可信证书链。证书异常时不得自动改成 `encrypt: false`。

完整连接 URL 与分字段配置均可使用。URL 中的密码只存在于环境值中，不得复制到 JSON。URL 路径或查询参数中的数据库名会被忽略，实际目标始终由导出命令的第二个参数决定。若同一字段同时提供直写值和 `*Env`，配置校验会失败。

## 环境变量解析

脚本只解析连接配置明确引用的变量，优先级为：

1. 当前进程环境变量；
2. 项目根目录 `.env.local`；
3. 项目根目录 `.env`。

`.env.example` 只用于发现变量名，不作为值来源。dotenv 内容按数据解析，不通过 Shell 执行，也不支持命令替换。

密码变量和 `urlEnv` 属于秘密来源。若其值来自已被 Git 跟踪或未被 Git 忽略的 dotenv 文件，脚本会停止执行。Agent 不得要求用户在聊天中发送秘密；只能帮助添加空变量名、检查忽略规则，并让用户在本地填写值。

## 指定目标

```bash
python <skill目录>/scripts/export_schema.py <连接别名> <数据库名>
```

例如 `export_schema.py yuga res-v4` 使用连接别名 `yuga` 导出数据库 `res-v4`。连接别名只做不区分大小写的精确匹配；数据库名不参与连接选择。Agent 可从明确上下文补齐参数，无法唯一判断时必须询问用户。

数据库名会成为快照目录名，因此必须是安全的单级目录名称，不能包含路径分隔符、Windows 非法字符、`.`、`..` 或保留设备名。
