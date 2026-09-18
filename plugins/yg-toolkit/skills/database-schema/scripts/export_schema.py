#!/usr/bin/env python3
"""从当前项目登记的数据库生成分类 DDL 结构快照。"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, Sequence
from urllib.parse import parse_qs, unquote, urlsplit

STORAGE_NAME = ".database-schema"
CONFIG_NAME = "connections.json"
SCHEMAS_NAME = "schemas"
TEMP_NAME = ".tmp"
REPORT_NAME = "last-run.json"
ENGINE_ALIASES = {
    "mysql": "mysql",
    "mariadb": "mysql",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "pgsql": "postgresql",
    "mssql": "sqlserver",
    "sql-server": "sqlserver",
    "sqlserver": "sqlserver",
}
SECRET_FIELD_NAMES = {"password", "passwd", "pwd", "secret", "token"}
ALLOWED_CONNECTION_FIELDS = {
    "enabled",
    "alias",
    "engine",
    "urlEnv",
    "host",
    "hostEnv",
    "port",
    "portEnv",
    "username",
    "usernameEnv",
    "passwordEnv",
    "sslMode",
    "sslModeEnv",
    "timeoutSeconds",
    "authentication",
    "encrypt",
    "trustServerCertificate",
}
ENV_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
INVALID_PATH_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


class ExportError(RuntimeError):
    """可安全呈现给用户的导出错误。"""


class ConfigError(ExportError):
    """连接配置错误。"""


class SecurityError(ExportError):
    """秘密处理不满足安全约束。"""


class ToolMissingError(ExportError):
    """缺少必需的外部工具。"""


class DatabaseCliError(ExportError):
    """数据库 CLI 已执行但返回失败。"""

    def __init__(self, returncode: int, detail: str) -> None:
        self.returncode = returncode
        self.detail = detail
        super().__init__(f"数据库 CLI 执行失败（退出码 {returncode}）：{detail}")


class ActionRequiredError(ExportError):
    """需要用户或管理员完成明确处置后才能继续。"""

    def __init__(self, message: str, *, code: str, action: str) -> None:
        self.code = code
        self.action = action
        super().__init__(message)


@dataclass(frozen=True)
class Layout:
    root: Path
    storage: Path
    config: Path
    schemas: Path
    temp: Path
    report: Path


@dataclass(frozen=True)
class ResolvedValue:
    value: str
    source: str
    source_path: Path | None = None


@dataclass(frozen=True)
class Connection:
    alias: str
    engine: str
    host: str
    port: int
    database: str
    username: str | None
    password: str | None
    timeout: int
    authentication: str
    ssl_mode: str | None
    encrypt: bool
    trust_server_certificate: bool


@dataclass(frozen=True)
class ObjectRecord:
    object_type: str
    name: str
    file: str
    schema: str | None = None


class SecretRedactor:
    """在错误进入日志前替换已解析的秘密值。"""

    def __init__(self) -> None:
        self._values: list[str] = []

    def add(self, value: str | None) -> None:
        if value and value not in self._values:
            self._values.append(value)

    def redact(self, text: str) -> str:
        result = text
        for value in sorted(self._values, key=len, reverse=True):
            result = result.replace(value, "***")
        return result


def discover_project_root(start: Path | None = None) -> Path:
    """Git 项目使用顶层目录，其他项目使用当前目录。"""

    current = (start or Path.cwd()).resolve()
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=current,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode == 0 and result.stdout.strip():
        return Path(result.stdout.strip()).resolve()
    return current


def build_layout(root: Path) -> Layout:
    storage = root / STORAGE_NAME
    return Layout(
        root=root,
        storage=storage,
        config=storage / CONFIG_NAME,
        schemas=storage / SCHEMAS_NAME,
        temp=storage / TEMP_NAME,
        report=storage / REPORT_NAME,
    )


def init_storage(layout: Layout) -> None:
    """创建固定目录与连接模板，不覆盖用户已有配置。"""

    layout.storage.mkdir(parents=True, exist_ok=True)
    ignore_path = layout.storage / ".gitignore"
    if not ignore_path.exists():
        ignore_path.write_text(
            "connections.json\n.tmp/\nlast-run.json\n",
            encoding="utf-8",
        )

    if layout.config.exists():
        print(f"连接配置已存在，未覆盖：{layout.config}")
        return

    template = (
        Path(__file__).resolve().parent.parent / "assets" / "connections.example.json"
    )
    if not template.is_file():
        raise ConfigError(f"内置连接模板不存在：{template}")
    shutil.copyfile(template, layout.config)
    print(f"已创建连接配置：{layout.config}")
    print("请启用并填写连接条目；真实密码只写入环境变量或已忽略的 dotenv 文件。")


def parse_dotenv(path: Path) -> dict[str, str]:
    """解析常用 dotenv 语法，不执行命令或表达式。"""

    values: dict[str, str] = {}
    if not path.is_file():
        return values
    try:
        content = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ConfigError(f"dotenv 文件不是有效 UTF-8：{path}") from exc

    for line_number, raw_line in enumerate(content.splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            raise ConfigError(f"dotenv 格式错误：{path}:{line_number}")
        key, raw_value = line.split("=", 1)
        key = key.strip()
        if not ENV_NAME_PATTERN.fullmatch(key):
            raise ConfigError(f"dotenv 变量名无效：{path}:{line_number}")
        raw_value = raw_value.strip()
        if raw_value.startswith("'"):
            if len(raw_value) < 2 or not raw_value.endswith("'"):
                raise ConfigError(f"dotenv 单引号未闭合：{path}:{line_number}")
            value = raw_value[1:-1]
        elif raw_value.startswith('"'):
            if len(raw_value) < 2 or not raw_value.endswith('"'):
                raise ConfigError(f"dotenv 双引号未闭合：{path}:{line_number}")
            try:
                value = json.loads(raw_value)
            except json.JSONDecodeError as exc:
                raise ConfigError(f"dotenv 双引号值无效：{path}:{line_number}") from exc
        else:
            value = re.split(r"\s+#", raw_value, maxsplit=1)[0].rstrip()
        values[key] = value
    return values


class EnvironmentResolver:
    """按进程、.env.local、.env 的顺序解析连接变量。"""

    def __init__(self, root: Path, redactor: SecretRedactor) -> None:
        self.root = root
        self.redactor = redactor
        self.local_path = root / ".env.local"
        self.base_path = root / ".env"
        self.local_values = parse_dotenv(self.local_path)
        self.base_values = parse_dotenv(self.base_path)

    def resolve(
        self, name: str, *, secret: bool, required: bool = True
    ) -> ResolvedValue | None:
        if not isinstance(name, str) or not ENV_NAME_PATTERN.fullmatch(name):
            raise ConfigError(f"环境变量名无效：{name!r}")
        if name in os.environ:
            result = ResolvedValue(os.environ[name], "process")
        elif name in self.local_values:
            result = ResolvedValue(
                self.local_values[name], ".env.local", self.local_path
            )
        elif name in self.base_values:
            result = ResolvedValue(self.base_values[name], ".env", self.base_path)
        elif required:
            raise ConfigError(f"缺少环境变量：{name}")
        else:
            return None

        if required and result.value == "":
            raise ConfigError(f"环境变量为空：{name}")
        if secret:
            self.redactor.add(result.value)
            if result.source_path is not None:
                self._assert_secret_file_safe(result.source_path, name)
        return result

    def _assert_secret_file_safe(self, path: Path, variable: str) -> None:
        git_root = _git_root(self.root)
        if git_root is None:
            return
        try:
            relative = path.resolve().relative_to(git_root).as_posix()
        except ValueError as exc:
            raise SecurityError(f"秘密文件不在当前 Git 项目内：{path}") from exc

        tracked = (
            subprocess.run(
                ["git", "ls-files", "--error-unmatch", "--", relative],
                cwd=git_root,
                capture_output=True,
                check=False,
            ).returncode
            == 0
        )
        ignored = (
            subprocess.run(
                ["git", "check-ignore", "-q", "--", relative],
                cwd=git_root,
                capture_output=True,
                check=False,
            ).returncode
            == 0
        )
        if tracked:
            raise SecurityError(
                f"变量 {variable} 来自已被 Git 跟踪的秘密文件：{path}。请先迁移秘密并处理泄露风险。"
            )
        if not ignored:
            raise SecurityError(
                f"变量 {variable} 来自未被 Git 忽略的文件：{path}。请先更新 .gitignore。"
            )


def _git_root(path: Path) -> Path | None:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=path,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return Path(result.stdout.strip()).resolve() if result.returncode == 0 else None


def read_config(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ConfigError(f"连接配置不存在：{path}。请先运行 --init。")
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ConfigError(f"连接配置不是有效 UTF-8 JSON：{path}") from exc
    if not isinstance(data, dict):
        raise ConfigError("connections.json 必须是 JSON 对象。")
    if data.get("version") == 1:
        raise ConfigError(
            "connections.json version=1 已过期；请升级为 version=2，"
            "将 keyword 改为 alias，移除 database/databaseEnv，"
            "并在导出命令中显式提供数据库名。"
        )
    if data.get("version") != 2:
        raise ConfigError("connections.json 必须是 version=2 的对象。")
    connections = data.get("connections")
    if not isinstance(connections, list):
        raise ConfigError("connections 必须是数组。")

    enabled: list[dict[str, Any]] = []
    aliases: set[str] = set()
    for index, raw in enumerate(connections):
        if not isinstance(raw, dict):
            raise ConfigError(f"connections[{index}] 必须是对象。")
        _reject_plaintext_secrets(raw, index)
        if raw.get("enabled", True) is False:
            continue
        alias = raw.get("alias")
        if not isinstance(alias, str) or not alias.strip():
            raise ConfigError(f"connections[{index}].alias 不能为空。")
        alias = alias.strip()
        validate_path_component(alias, "连接别名")
        folded = alias.casefold()
        if folded in aliases:
            raise ConfigError(f"连接别名重复：{alias}")
        aliases.add(folded)
        item = dict(raw)
        item["alias"] = alias
        enabled.append(item)
    return enabled


def _reject_plaintext_secrets(raw: Mapping[str, Any], index: int) -> None:
    _scan_nested_secrets(raw, f"connections[{index}]")
    for key, value in raw.items():
        if key not in ALLOWED_CONNECTION_FIELDS:
            raise ConfigError(f"connections[{index}] 包含不支持的字段：{key!r}")
        if isinstance(value, (dict, list)):
            raise ConfigError(f"connections[{index}].{key} 必须是标量值。")


def _scan_nested_secrets(value: Any, path: str) -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            normalized = re.sub(r"[^a-z]", "", str(key).lower())
            looks_secret = any(term in normalized for term in SECRET_FIELD_NAMES)
            allowed_reference = str(key) in {"passwordEnv", "urlEnv"}
            if looks_secret and not allowed_reference and nested not in (None, ""):
                raise SecurityError(
                    f"{path} 包含禁止的明文秘密字段 {key!r}；请改用 passwordEnv 或 urlEnv。"
                )
            _scan_nested_secrets(nested, f"{path}.{key}")
    elif isinstance(value, list):
        for item_index, nested in enumerate(value):
            _scan_nested_secrets(nested, f"{path}[{item_index}]")


def validate_path_component(value: str, label: str) -> None:
    if value in {".", ".."} or INVALID_PATH_CHARS.search(value):
        raise ConfigError(f"{label} 不能安全用于目录名：{value!r}")
    if value.rstrip(". ") != value:
        raise ConfigError(f"{label} 不能以空格或点结尾：{value!r}")
    if value.split(".", 1)[0].upper() in WINDOWS_RESERVED_NAMES:
        raise ConfigError(f"{label} 使用了 Windows 保留名称：{value!r}")
    if len(value) > 80:
        raise ConfigError(f"{label} 不能超过 80 个字符。")


def select_connection(
    raw_connections: list[dict[str, Any]], alias: str
) -> dict[str, Any]:
    if not raw_connections:
        raise ConfigError("当前没有启用的数据库连接。请编辑 connections.json。")
    alias_matches = [
        item
        for item in raw_connections
        if item["alias"].casefold() == alias.casefold()
    ]
    if alias_matches:
        return alias_matches[0]
    choices = "、".join(item["alias"] for item in raw_connections)
    raise ConfigError(f"未找到连接别名 {alias!r}。可用连接：{choices}")


def _resolve_field(
    raw: Mapping[str, Any],
    field: str,
    resolver: EnvironmentResolver,
    *,
    secret: bool = False,
    required: bool = False,
) -> str | None:
    env_key = f"{field}Env"
    literal_present = field in raw and raw[field] not in (None, "")
    env_present = env_key in raw and raw[env_key] not in (None, "")
    if literal_present and env_present:
        raise ConfigError(f"{field} 与 {env_key} 只能配置一个。")
    if secret and literal_present:
        raise SecurityError(f"{field} 不允许明文配置，请使用 {env_key}。")
    if env_present:
        result = resolver.resolve(str(raw[env_key]), secret=secret, required=required)
        return result.value if result else None
    if literal_present:
        return str(raw[field]).strip()
    if required:
        raise ConfigError(f"缺少连接字段：{field} 或 {env_key}")
    return None


def resolve_connection(
    raw: Mapping[str, Any], resolver: EnvironmentResolver, database: str
) -> Connection:
    alias = str(raw["alias"])
    database = database.strip()
    if not database:
        raise ConfigError("数据库名不能为空。")
    validate_path_component(database, "数据库名")
    engine_raw = str(raw.get("engine", "")).strip().lower()
    engine = ENGINE_ALIASES.get(engine_raw)
    if not engine:
        raise ConfigError(f"连接 {alias} 的 engine 不受支持：{engine_raw!r}")

    url_value: str | None = None
    if raw.get("urlEnv"):
        resolved = resolver.resolve(str(raw["urlEnv"]), secret=True, required=True)
        assert resolved is not None
        url_value = resolved.value

    url_fields: dict[str, Any] = {}
    if url_value:
        parsed = urlsplit(url_value)
        scheme_engine = ENGINE_ALIASES.get(parsed.scheme.lower().split("+", 1)[0])
        if scheme_engine != engine:
            raise ConfigError(f"连接 {alias} 的 URL 协议与 engine 不一致。")
        query_values = parse_qs(parsed.query)
        url_fields = {
            "host": parsed.hostname,
            "port": parsed.port,
            "username": unquote(parsed.username) if parsed.username else None,
            "password": unquote(parsed.password) if parsed.password else None,
            "query": query_values,
        }
        resolver.redactor.add(url_fields.get("password"))

    def resolved_or_url(field: str, *, required: bool = False) -> str | None:
        configured = _resolve_field(raw, field, resolver, required=False)
        value = configured if configured not in (None, "") else url_fields.get(field)
        if required and value in (None, ""):
            raise ConfigError(f"连接 {alias} 缺少 {field}。")
        return str(value) if value is not None else None

    host = resolved_or_url("host", required=True)
    assert host is not None
    authentication = str(raw.get("authentication", "password")).strip().lower()
    if authentication not in {"password", "integrated"}:
        raise ConfigError(
            f"连接 {alias} 的 authentication 只支持 password 或 integrated。"
        )
    if engine != "sqlserver" and authentication == "integrated":
        raise ConfigError(f"连接 {alias} 只有 SQL Server 支持 integrated 认证。")

    username = resolved_or_url("username", required=authentication != "integrated")
    password = _resolve_field(raw, "password", resolver, secret=True, required=False)
    if password is None:
        password = url_fields.get("password")
    resolver.redactor.add(password)
    if engine == "sqlserver" and authentication == "password" and password is None:
        raise ConfigError(
            f"连接 {alias} 使用 SQL Server 密码认证时必须配置 passwordEnv。"
        )

    port_value = _resolve_field(raw, "port", resolver, required=False)
    if port_value is None and url_fields.get("port") is not None:
        port_value = str(url_fields["port"])
    default_port = {"mysql": 3306, "postgresql": 5432, "sqlserver": 1433}[engine]
    try:
        port = int(port_value) if port_value else default_port
    except ValueError as exc:
        raise ConfigError(f"连接 {alias} 的端口不是整数。") from exc
    if not 1 <= port <= 65535:
        raise ConfigError(f"连接 {alias} 的端口超出范围。")

    try:
        timeout = int(raw.get("timeoutSeconds", 120))
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"连接 {alias} 的 timeoutSeconds 不是整数。") from exc
    if not 1 <= timeout <= 3600:
        raise ConfigError(f"连接 {alias} 的 timeoutSeconds 必须在 1 到 3600 之间。")

    query = {
        str(key).casefold(): value
        for key, value in (url_fields.get("query") or {}).items()
    }
    sslmode = _resolve_field(raw, "sslMode", resolver, required=False)
    if sslmode is None:
        sslmode = query.get("sslmode", [None])[0] or query.get("ssl-mode", [None])[0]
    encrypt_default = engine == "sqlserver" or str(sslmode).lower() in {
        "require",
        "verify-ca",
        "verify-full",
    }
    if query.get("encrypt"):
        encrypt_default = str(query["encrypt"][0]).casefold() in {
            "1",
            "true",
            "yes",
            "mandatory",
        }
    trust_default = False
    if query.get("trustservercertificate"):
        trust_default = str(query["trustservercertificate"][0]).casefold() in {
            "1",
            "true",
            "yes",
        }
    return Connection(
        alias=alias,
        engine=engine,
        host=host,
        port=port,
        database=database,
        username=username,
        password=password,
        timeout=timeout,
        authentication=authentication,
        ssl_mode=sslmode,
        encrypt=_config_bool(raw, "encrypt", encrypt_default),
        trust_server_certificate=_config_bool(
            raw, "trustServerCertificate", trust_default
        ),
    )


def _config_bool(raw: Mapping[str, Any], field: str, default: bool) -> bool:
    value = raw.get(field, default)
    if not isinstance(value, bool):
        raise ConfigError(f"{field} 必须是 JSON 布尔值 true 或 false。")
    return value


def require_tools(engine: str, tools: Sequence[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    missing: list[str] = []
    for tool in tools:
        path = shutil.which(tool)
        if path:
            found[tool] = path
        else:
            missing.append(tool)
    if missing:
        hint = {
            "mysql": "安装 MySQL Client，或在批准后评估官方 MySQL 容器。",
            "postgresql": "安装兼容版本的 PostgreSQL Client（psql 与 pg_dump）。",
            "sqlserver": "安装 Microsoft sqlcmd、PowerShell 7 和 PowerShell SqlServer 模块。",
        }[engine]
        raise ToolMissingError(f"缺少工具：{', '.join(missing)}。{hint}")
    return found


def run_command(
    args: Sequence[str],
    *,
    timeout: int,
    redactor: SecretRedactor,
    env: Mapping[str, str] | None = None,
) -> str:
    process_env = os.environ.copy()
    if env:
        process_env.update(env)
    try:
        result = subprocess.run(
            list(args),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=process_env,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ExportError(f"数据库 CLI 在 {timeout} 秒后超时。") from exc
    except OSError as exc:
        raise ExportError(f"无法启动数据库 CLI：{exc}") from exc
    if result.returncode != 0:
        detail = redactor.redact((result.stderr or result.stdout).strip())
        raise DatabaseCliError(result.returncode, detail)
    return result.stdout


def _is_untrusted_sqlserver_certificate_error(detail: str) -> bool:
    """识别 SQL Server 常见的不受信任证书链错误。"""

    normalized = detail.casefold()
    patterns = (
        "certificate chain was issued by an authority that is not trusted",
        "certificate chain is not trusted",
        "certificate verify failed",
        "self signed certificate",
        "证书链是由不受信任的颁发机构颁发的",
        "证书链不受信任",
    )
    return any(pattern in normalized for pattern in patterns)


def safe_file_stem(identifier: str) -> str:
    readable = INVALID_PATH_CHARS.sub("_", identifier)
    readable = re.sub(r"\s+", "_", readable).strip(". _") or "object"
    if readable.split(".", 1)[0].upper() in WINDOWS_RESERVED_NAMES:
        readable = f"_{readable}"
    readable = readable[:100].rstrip(". ") or "object"
    digest = hashlib.sha256(identifier.encode("utf-8")).hexdigest()[:10]
    return f"{readable}--{digest}"


def quote_pg_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def quote_mysql_identifier(value: str) -> str:
    return "`" + value.replace("`", "``") + "`"


def quote_sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def ensure_statement(text: str, *, delimiter: bool = False) -> str:
    ddl = text.strip()
    if delimiter:
        return f"DELIMITER $$\n{ddl.rstrip(';')}$$\nDELIMITER ;\n"
    return ddl + ("\n" if ddl.endswith(";") else ";\n")


def write_object(
    staging: Path,
    object_type: str,
    identifier: str,
    ddl: str,
    *,
    schema: str | None = None,
    name: str | None = None,
) -> ObjectRecord:
    if not ddl.strip():
        raise ExportError(f"对象 {identifier} 的 DDL 为空。")
    folder = staging / object_type
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{safe_file_stem(identifier)}.sql"
    path.write_text(ddl.rstrip() + "\n", encoding="utf-8", newline="\n")
    return ObjectRecord(
        object_type=object_type,
        name=name or identifier,
        schema=schema,
        file=path.relative_to(staging).as_posix(),
    )


class MySQLExporter:
    def __init__(self, connection: Connection, redactor: SecretRedactor) -> None:
        self.connection = connection
        self.redactor = redactor
        self.mysql = require_tools("mysql", ["mysql"])["mysql"]

    @contextmanager
    def option_file(self) -> Iterator[Path]:
        lines = [
            "[client]",
            f"host={_mysql_option_value(self.connection.host)}",
            f"port={self.connection.port}",
            f"user={_mysql_option_value(self.connection.username or '')}",
            f"database={_mysql_option_value(self.connection.database)}",
            "default-character-set=utf8mb4",
        ]
        if self.connection.ssl_mode:
            lines.append(f"ssl-mode={_mysql_option_value(self.connection.ssl_mode)}")
        if self.connection.password is not None:
            lines.append(f"password={_mysql_option_value(self.connection.password)}")
        handle = tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            prefix="db-schema-mysql-",
            suffix=".cnf",
            delete=False,
        )
        path = Path(handle.name)
        try:
            handle.write("\n".join(lines) + "\n")
            handle.close()
            try:
                path.chmod(0o600)
            except OSError:
                pass
            yield path
        finally:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass

    def query(self, option_file: Path, sql: str) -> list[dict[str, str]]:
        output = run_command(
            [
                self.mysql,
                f"--defaults-extra-file={option_file}",
                "--xml",
                "--batch",
                "--raw",
                "--execute",
                sql,
            ],
            timeout=self.connection.timeout,
            redactor=self.redactor,
        )
        try:
            root = ET.fromstring(output)
        except ET.ParseError as exc:
            raise ExportError("mysql 返回了无法解析的 XML。") from exc
        rows: list[dict[str, str]] = []
        for row in root.findall(".//row"):
            values: dict[str, str] = {}
            for field in row.findall("field"):
                values[field.attrib.get("name", "")] = field.text or ""
            rows.append(values)
        return rows

    def export(self, staging: Path) -> list[ObjectRecord]:
        records: list[ObjectRecord] = []
        with self.option_file() as option_file:
            relations = self.query(
                option_file,
                "SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES "
                "WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_TYPE, TABLE_NAME",
            )
            for row in relations:
                name = row["TABLE_NAME"]
                is_view = row["TABLE_TYPE"].upper() == "VIEW"
                command = "SHOW CREATE VIEW" if is_view else "SHOW CREATE TABLE"
                result = self.query(
                    option_file, f"{command} {quote_mysql_identifier(name)}"
                )
                field = "Create View" if is_view else "Create Table"
                ddl = _mysql_show_value(result, field, name)
                ddl = _strip_mysql_definer(ddl)
                ddl = re.sub(r"\sAUTO_INCREMENT=\d+\b", "", ddl)
                object_type = "view" if is_view else "table"
                records.append(
                    write_object(
                        staging, object_type, name, ensure_statement(ddl), name=name
                    )
                )

            routines = self.query(
                option_file,
                "SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES "
                "WHERE ROUTINE_SCHEMA = DATABASE() ORDER BY ROUTINE_TYPE, ROUTINE_NAME",
            )
            for row in routines:
                name = row["ROUTINE_NAME"]
                routine_type = row["ROUTINE_TYPE"].upper()
                result = self.query(
                    option_file,
                    f"SHOW CREATE {routine_type} {quote_mysql_identifier(name)}",
                )
                field = (
                    "Create Function"
                    if routine_type == "FUNCTION"
                    else "Create Procedure"
                )
                ddl = _strip_mysql_definer(_mysql_show_value(result, field, name))
                object_type = "function" if routine_type == "FUNCTION" else "procedure"
                records.append(
                    write_object(
                        staging,
                        object_type,
                        name,
                        ensure_statement(ddl, delimiter=True),
                        name=name,
                    )
                )

            for object_type, list_sql, show_command, field in (
                (
                    "trigger",
                    "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS "
                    "WHERE TRIGGER_SCHEMA = DATABASE() ORDER BY TRIGGER_NAME",
                    "SHOW CREATE TRIGGER",
                    "SQL Original Statement",
                ),
                (
                    "event",
                    "SELECT EVENT_NAME FROM information_schema.EVENTS "
                    "WHERE EVENT_SCHEMA = DATABASE() ORDER BY EVENT_NAME",
                    "SHOW CREATE EVENT",
                    "Create Event",
                ),
            ):
                for row in self.query(option_file, list_sql):
                    name = row[
                        "TRIGGER_NAME" if object_type == "trigger" else "EVENT_NAME"
                    ]
                    result = self.query(
                        option_file, f"{show_command} {quote_mysql_identifier(name)}"
                    )
                    ddl = _strip_mysql_definer(_mysql_show_value(result, field, name))
                    records.append(
                        write_object(
                            staging,
                            object_type,
                            name,
                            ensure_statement(ddl, delimiter=True),
                            name=name,
                        )
                    )
        return records


def _mysql_option_value(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _mysql_show_value(rows: list[dict[str, str]], field: str, name: str) -> str:
    if len(rows) != 1 or not rows[0].get(field):
        raise ExportError(f"无法读取 MySQL 对象 {name} 的 {field}。")
    return rows[0][field]


def _strip_mysql_definer(ddl: str) -> str:
    account = r"(?:`(?:``|[^`])+`|'(?:''|[^'])+'|[^\s@]+)"
    cleaned = re.sub(
        rf"\s+DEFINER\s*=\s*{account}\s*@\s*{account}",
        "",
        ddl,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        rf"/\*!\d+\s+DEFINER\s*=\s*{account}\s*@\s*{account}\s*\*/",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned


class PostgreSQLExporter:
    def __init__(self, connection: Connection, redactor: SecretRedactor) -> None:
        self.connection = connection
        self.redactor = redactor
        tools = require_tools("postgresql", ["psql", "pg_dump"])
        self.psql = tools["psql"]
        self.pg_dump = tools["pg_dump"]
        self.env = {}
        if connection.password is not None:
            self.env["PGPASSWORD"] = connection.password
        if connection.ssl_mode:
            self.env["PGSSLMODE"] = connection.ssl_mode

    def connection_args(self) -> list[str]:
        args = [
            "--host",
            self.connection.host,
            "--port",
            str(self.connection.port),
            "--dbname",
            self.connection.database,
            "--no-password",
        ]
        if self.connection.username:
            args.extend(["--username", self.connection.username])
        return args

    def query(self, sql: str) -> list[list[str]]:
        output = run_command(
            [
                self.psql,
                *self.connection_args(),
                "--no-psqlrc",
                "--set=ON_ERROR_STOP=1",
                "--csv",
                "--tuples-only",
                "--command",
                sql,
            ],
            timeout=self.connection.timeout,
            redactor=self.redactor,
            env=self.env,
        )
        return [row for row in csv.reader(io.StringIO(output)) if row]

    def dump_relation(self, schema: str, name: str, *, pre_data_only: bool) -> str:
        pattern = f"{quote_pg_identifier(schema)}.{quote_pg_identifier(name)}"
        args = [
            self.pg_dump,
            *self.connection_args(),
            "--schema-only",
            "--no-owner",
            "--no-privileges",
            "--no-security-labels",
            "--strict-names",
            f"--table={pattern}",
        ]
        if pre_data_only:
            args.append("--section=pre-data")
        return run_command(
            args,
            timeout=self.connection.timeout,
            redactor=self.redactor,
            env=self.env,
        )

    def export(self, staging: Path) -> list[ObjectRecord]:
        records: list[ObjectRecord] = []
        schema_rows = self.query(
            "SELECT nspname FROM pg_namespace "
            "WHERE nspname NOT IN ('pg_catalog','information_schema') "
            "AND nspname !~ '^pg_(toast|temp)' ORDER BY nspname"
        )
        for (schema,) in schema_rows:
            ddl = f"CREATE SCHEMA IF NOT EXISTS {quote_pg_identifier(schema)};\n"
            records.append(
                write_object(staging, "schema", schema, ddl, schema=schema, name=schema)
            )

        extension_rows = self.query(
            "SELECT e.extname, n.nspname, e.extversion FROM pg_extension e "
            "JOIN pg_namespace n ON n.oid=e.extnamespace "
            "WHERE e.extname <> 'plpgsql' ORDER BY e.extname"
        )
        for name, schema, version in extension_rows:
            ddl = (
                f"CREATE EXTENSION IF NOT EXISTS {quote_pg_identifier(name)} "
                f"WITH SCHEMA {quote_pg_identifier(schema)} VERSION {quote_sql_literal(version)};\n"
            )
            records.append(
                write_object(staging, "extension", name, ddl, schema=schema, name=name)
            )

        relation_rows = self.query(
            "SELECT c.oid::text, n.nspname, c.relname, c.relkind "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE c.relkind IN ('r','p','f','v','m','S') "
            "AND n.nspname NOT IN ('pg_catalog','information_schema') "
            "AND n.nspname !~ '^pg_toast' "
            "AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass "
            "AND d.objid=c.oid AND d.deptype='e') "
            "ORDER BY n.nspname, c.relname"
        )
        for oid, schema, name, kind in relation_rows:
            identifier = f"{schema}.{name}"
            if kind in {"r", "p", "f"}:
                ddl = self.dump_relation(schema, name, pre_data_only=True)
                additions: list[str] = []
                for constraint_name, definition in self.query(
                    "SELECT conname, pg_get_constraintdef(oid, true) FROM pg_constraint "
                    f"WHERE conrelid={int(oid)} ORDER BY contype, conname"
                ):
                    additions.append(
                        f"ALTER TABLE ONLY {quote_pg_identifier(schema)}.{quote_pg_identifier(name)} "
                        f"ADD CONSTRAINT {quote_pg_identifier(constraint_name)} {definition};"
                    )
                for (definition,) in self.query(
                    "SELECT pg_get_indexdef(i.indexrelid) FROM pg_index i "
                    "LEFT JOIN pg_constraint c ON c.conindid=i.indexrelid "
                    f"WHERE i.indrelid={int(oid)} AND c.oid IS NULL ORDER BY i.indexrelid"
                ):
                    additions.append(ensure_statement(definition).rstrip())
                partition_rows = self.query(
                    "SELECT pn.nspname, pc.relname, pg_get_expr(c.relpartbound, c.oid) "
                    "FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid "
                    "JOIN pg_class pc ON pc.oid=i.inhparent "
                    "JOIN pg_namespace pn ON pn.oid=pc.relnamespace "
                    f"WHERE i.inhrelid={int(oid)} AND c.relispartition"
                )
                for parent_schema, parent_name, bound in partition_rows:
                    additions.append(
                        f"ALTER TABLE {quote_pg_identifier(parent_schema)}.{quote_pg_identifier(parent_name)} "
                        f"ATTACH PARTITION {quote_pg_identifier(schema)}.{quote_pg_identifier(name)} {bound};"
                    )
                if additions:
                    ddl = ddl.rstrip() + "\n\n" + "\n".join(additions) + "\n"
                object_type = "table"
            elif kind == "v":
                definition = self.query(f"SELECT pg_get_viewdef({int(oid)}, true)")[0][
                    0
                ]
                ddl = (
                    f"CREATE VIEW {quote_pg_identifier(schema)}.{quote_pg_identifier(name)} AS\n"
                    f"{definition.rstrip(';')};\n"
                )
                object_type = "view"
            elif kind == "m":
                definition = self.query(f"SELECT pg_get_viewdef({int(oid)}, true)")[0][
                    0
                ]
                ddl = (
                    f"CREATE MATERIALIZED VIEW {quote_pg_identifier(schema)}.{quote_pg_identifier(name)} AS\n"
                    f"{definition.rstrip(';')}\nWITH NO DATA;\n"
                )
                object_type = "materialized_view"
            else:
                ddl = self.dump_relation(schema, name, pre_data_only=False)
                object_type = "sequence"
            records.append(
                write_object(
                    staging,
                    object_type,
                    identifier,
                    ddl,
                    schema=schema,
                    name=name,
                )
            )

        function_rows = self.query(
            "SELECT p.oid::text, n.nspname, p.proname, "
            "pg_get_function_identity_arguments(p.oid), p.prokind "
            "FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace "
            "WHERE p.prokind IN ('f','p','w') "
            "AND n.nspname NOT IN ('pg_catalog','information_schema') "
            "AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass "
            "AND d.objid=p.oid AND d.deptype='e') "
            "ORDER BY n.nspname, p.proname, 4"
        )
        for oid, schema, name, arguments, kind in function_rows:
            rows = self.query(f"SELECT pg_get_functiondef({int(oid)})")
            if len(rows) != 1:
                raise ExportError(f"无法读取 PostgreSQL 函数：{schema}.{name}")
            identifier = f"{schema}.{name}({arguments})"
            object_type = "procedure" if kind == "p" else "function"
            records.append(
                write_object(
                    staging,
                    object_type,
                    identifier,
                    rows[0][0],
                    schema=schema,
                    name=f"{name}({arguments})",
                )
            )

        trigger_rows = self.query(
            "SELECT t.oid::text, n.nspname, c.relname, t.tgname "
            "FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "
            "JOIN pg_namespace n ON n.oid=c.relnamespace "
            "WHERE NOT t.tgisinternal AND n.nspname NOT IN ('pg_catalog','information_schema') "
            "ORDER BY n.nspname, c.relname, t.tgname"
        )
        for oid, schema, table, name in trigger_rows:
            ddl = self.query(f"SELECT pg_get_triggerdef({int(oid)}, true)")[0][0]
            identifier = f"{schema}.{table}.{name}"
            records.append(
                write_object(
                    staging,
                    "trigger",
                    identifier,
                    ensure_statement(ddl),
                    schema=schema,
                    name=f"{table}.{name}",
                )
            )

        records.extend(self._export_types(staging))
        return records

    def _export_types(self, staging: Path) -> list[ObjectRecord]:
        records: list[ObjectRecord] = []
        type_rows = self.query(
            "SELECT t.oid::text, n.nspname, t.typname, t.typtype "
            "FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace "
            "LEFT JOIN pg_class c ON c.oid=t.typrelid "
            "WHERE t.typtype IN ('e','d','c','r') "
            "AND n.nspname NOT IN ('pg_catalog','information_schema') "
            "AND (t.typtype <> 'c' OR c.relkind='c') "
            "AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass "
            "AND d.objid=t.oid AND d.deptype='e') "
            "ORDER BY n.nspname, t.typname"
        )
        for oid, schema, name, kind in type_rows:
            qualified = f"{quote_pg_identifier(schema)}.{quote_pg_identifier(name)}"
            if kind == "e":
                labels = [
                    row[0]
                    for row in self.query(
                        "SELECT quote_literal(enumlabel) FROM pg_enum "
                        f"WHERE enumtypid={int(oid)} ORDER BY enumsortorder"
                    )
                ]
                ddl = f"CREATE TYPE {qualified} AS ENUM ({', '.join(labels)});\n"
            elif kind == "d":
                rows = self.query(
                    "SELECT format_type(t.typbasetype, t.typtypmod), t.typnotnull::text, "
                    "COALESCE(pg_get_expr(t.typdefaultbin, 0), ''), "
                    "CASE WHEN t.typcollation <> bt.typcollation THEN "
                    "quote_ident(cn.nspname)||'.'||quote_ident(c.collname) ELSE '' END "
                    "FROM pg_type t JOIN pg_type bt ON bt.oid=t.typbasetype "
                    "LEFT JOIN pg_collation c ON c.oid=t.typcollation "
                    "LEFT JOIN pg_namespace cn ON cn.oid=c.collnamespace "
                    f"WHERE t.oid={int(oid)}"
                )
                base_type, not_null, default, collation = rows[0]
                parts = [f"CREATE DOMAIN {qualified} AS {base_type}"]
                if collation:
                    parts.append(f"COLLATE {collation}")
                if default:
                    parts.append(f"DEFAULT {default}")
                if not_null == "t":
                    parts.append("NOT NULL")
                for constraint_name, definition in self.query(
                    "SELECT conname, pg_get_constraintdef(oid, true) FROM pg_constraint "
                    f"WHERE contypid={int(oid)} ORDER BY conname"
                ):
                    parts.append(
                        f"CONSTRAINT {quote_pg_identifier(constraint_name)} {definition}"
                    )
                ddl = "\n  ".join(parts) + ";\n"
            elif kind == "c":
                attributes = []
                for attribute, data_type in self.query(
                    "SELECT a.attname, format_type(a.atttypid, a.atttypmod) "
                    "FROM pg_attribute a JOIN pg_type t ON t.typrelid=a.attrelid "
                    f"WHERE t.oid={int(oid)} AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum"
                ):
                    attributes.append(f"  {quote_pg_identifier(attribute)} {data_type}")
                ddl = (
                    f"CREATE TYPE {qualified} AS (\n"
                    + ",\n".join(attributes)
                    + "\n);\n"
                )
            else:
                rows = self.query(
                    "SELECT format_type(r.rngsubtype, NULL), "
                    "COALESCE(quote_ident(onsp.nspname)||'.'||quote_ident(op.opcname), ''), "
                    "COALESCE(quote_ident(cnsp.nspname)||'.'||quote_ident(c.collname), ''), "
                    "COALESCE(r.rngcanonical::regprocedure::text, ''), "
                    "COALESCE(r.rngsubdiff::regprocedure::text, ''), "
                    "COALESCE(mt.typname, '') "
                    "FROM pg_range r "
                    "LEFT JOIN pg_opclass op ON op.oid=r.rngsubopc "
                    "LEFT JOIN pg_namespace onsp ON onsp.oid=op.opcnamespace "
                    "LEFT JOIN pg_collation c ON c.oid=r.rngcollation "
                    "LEFT JOIN pg_namespace cnsp ON cnsp.oid=c.collnamespace "
                    "LEFT JOIN pg_type mt ON mt.oid=COALESCE((to_jsonb(r)->>'rngmultitypid')::oid, 0) "
                    f"WHERE r.rngtypid={int(oid)}"
                )
                if len(rows) != 1:
                    raise ExportError(f"无法读取 PostgreSQL 范围类型：{schema}.{name}")
                subtype, opclass, collation, canonical, diff, multirange = rows[0]
                options = [f"SUBTYPE = {subtype}"]
                if opclass:
                    options.append(f"SUBTYPE_OPCLASS = {opclass}")
                if collation:
                    options.append(f"COLLATION = {collation}")
                if canonical:
                    options.append(f"CANONICAL = {canonical}")
                if diff:
                    options.append(f"SUBTYPE_DIFF = {diff}")
                if multirange:
                    options.append(
                        f"MULTIRANGE_TYPE_NAME = {quote_pg_identifier(multirange)}"
                    )
                ddl = (
                    f"CREATE TYPE {qualified} AS RANGE (\n  "
                    + ",\n  ".join(options)
                    + "\n);\n"
                )
            identifier = f"{schema}.{name}"
            records.append(
                write_object(staging, "type", identifier, ddl, schema=schema, name=name)
            )
        return records


class SQLServerExporter:
    def __init__(self, connection: Connection, redactor: SecretRedactor) -> None:
        self.connection = connection
        self.redactor = redactor
        self.sqlcmd = require_tools("sqlserver", ["sqlcmd"])["sqlcmd"]
        self.powershell = shutil.which("pwsh") or shutil.which("powershell")
        if not self.powershell:
            raise ToolMissingError(
                "缺少 PowerShell；SQL Server 导出需要 PowerShell 与 SqlServer 模块。"
            )

    def export(self, staging: Path) -> list[ObjectRecord]:
        server = f"{self.connection.host},{self.connection.port}"
        args = [
            self.sqlcmd,
            "-S",
            server,
            "-d",
            self.connection.database,
            "-Q",
            "SET NOCOUNT ON; SELECT 1;",
            "-b",
            "-h",
            "-1",
            "-W",
            "-f",
            "65001",
        ]
        env: dict[str, str] = {}
        if self.connection.authentication == "integrated":
            args.append("-E")
        else:
            args.extend(["-U", self.connection.username or ""])
            if self.connection.password is not None:
                env["SQLCMDPASSWORD"] = self.connection.password
        if self.connection.encrypt:
            args.append("-N")
        if self.connection.trust_server_certificate:
            args.append("-C")
        try:
            run_command(
                args,
                timeout=self.connection.timeout,
                redactor=self.redactor,
                env=env,
            )
        except DatabaseCliError as exc:
            if (
                self.connection.encrypt
                and not self.connection.trust_server_certificate
                and _is_untrusted_sqlserver_certificate_error(exc.detail)
            ):
                raise ActionRequiredError(
                    "SQL Server 连接已加密，但服务器证书链不受当前机器信任。"
                    "正式或公网环境应修复服务器证书链；仅在用户明确接受无法验证服务器身份的风险后，"
                    "才可对该连接设置 trustServerCertificate=true。不要关闭加密作为自动回退。",
                    code="SQLSERVER_TLS_CERTIFICATE_UNTRUSTED",
                    action="repair-certificate-or-confirm-trust-server-certificate",
                ) from exc
            raise

        helper = Path(__file__).resolve().parent / "export_sqlserver.ps1"
        if not helper.is_file():
            raise ExportError(f"SQL Server 辅助脚本不存在：{helper}")
        helper_env = {
            "DB_SCHEMA_SQLSERVER_HOST": self.connection.host,
            "DB_SCHEMA_SQLSERVER_PORT": str(self.connection.port),
            "DB_SCHEMA_SQLSERVER_DATABASE": self.connection.database,
            "DB_SCHEMA_SQLSERVER_AUTH": self.connection.authentication,
            "DB_SCHEMA_SQLSERVER_USER": self.connection.username or "",
            "DB_SCHEMA_SQLSERVER_PASSWORD": self.connection.password or "",
            "DB_SCHEMA_SQLSERVER_ENCRYPT": str(self.connection.encrypt).lower(),
            "DB_SCHEMA_SQLSERVER_TRUST_CERT": str(
                self.connection.trust_server_certificate
            ).lower(),
        }
        run_command(
            [
                self.powershell,
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-File",
                str(helper),
                "-OutputDirectory",
                str(staging),
            ],
            timeout=max(self.connection.timeout, 900),
            redactor=self.redactor,
            env=helper_env,
        )
        objects_path = staging / "objects.json"
        if not objects_path.is_file():
            raise ExportError("SQL Server 辅助脚本未生成对象清单。")
        try:
            data = json.loads(objects_path.read_text(encoding="utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ExportError("SQL Server 对象清单无效。") from exc
        objects_path.unlink()
        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            raise ExportError("SQL Server 对象清单必须是数组。")
        try:
            records = [ObjectRecord(**item) for item in data]
        except (TypeError, KeyError) as exc:
            raise ExportError("SQL Server 对象清单字段不完整。") from exc
        if any(not (staging / record.file).is_file() for record in records):
            raise ExportError("SQL Server 对象清单引用了不存在的文件。")
        return records


def exporter_for(connection: Connection, redactor: SecretRedactor) -> Any:
    if connection.engine == "mysql":
        return MySQLExporter(connection, redactor)
    if connection.engine == "postgresql":
        return PostgreSQLExporter(connection, redactor)
    if connection.engine == "sqlserver":
        return SQLServerExporter(connection, redactor)
    raise ConfigError(f"不受支持的数据库类型：{connection.engine}")


def write_manifest(
    staging: Path, connection: Connection, records: list[ObjectRecord]
) -> None:
    ordered = sorted(
        records,
        key=lambda item: (item.object_type, item.schema or "", item.name, item.file),
    )
    manifest = {
        "formatVersion": 2,
        "status": "complete",
        "connectionAlias": connection.alias,
        "engine": connection.engine,
        "database": connection.database,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "objectCount": len(ordered),
        "objects": [
            {
                "type": item.object_type,
                "schema": item.schema,
                "name": item.name,
                "file": item.file,
            }
            for item in ordered
        ],
    }
    if connection.engine == "sqlserver":
        manifest["connectionSecurity"] = {
            "encrypted": connection.encrypt,
            "serverCertificateValidated": (
                connection.encrypt and not connection.trust_server_certificate
            ),
        }
    (staging / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def validate_staging(staging: Path, records: list[ObjectRecord]) -> None:
    files = sorted(path for path in staging.rglob("*.sql") if path.is_file())
    if len(files) != len(records):
        raise ExportError(
            f"对象清单数量 {len(records)} 与 SQL 文件数量 {len(files)} 不一致。"
        )
    for path in files:
        if path.stat().st_size == 0:
            raise ExportError(f"生成了空 SQL 文件：{path}")
    manifest_path = staging / "manifest.json"
    if not manifest_path.is_file():
        raise ExportError("缺少 manifest.json。")


def replace_snapshot(staging: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    backup = target.parent / f".{target.name}.backup-{uuid.uuid4().hex}"
    moved_old = False
    try:
        if target.exists():
            target.replace(backup)
            moved_old = True
        staging.replace(target)
    except Exception:
        if moved_old and backup.exists() and not target.exists():
            backup.replace(target)
        raise
    else:
        if backup.exists():
            shutil.rmtree(backup)


def export_one(layout: Layout, connection: Connection, redactor: SecretRedactor) -> int:
    layout.temp.mkdir(parents=True, exist_ok=True)
    staging = (
        layout.temp
        / f"{connection.alias}-{connection.database}-{uuid.uuid4().hex}"
    )
    staging.mkdir(parents=False, exist_ok=False)
    target = layout.schemas / connection.alias / connection.database
    try:
        records = exporter_for(connection, redactor).export(staging)
        write_manifest(staging, connection, records)
        validate_staging(staging, records)
        replace_snapshot(staging, target)
        return len(records)
    except Exception:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        raise


def write_report(layout: Layout, results: list[dict[str, Any]]) -> None:
    layout.storage.mkdir(parents=True, exist_ok=True)
    report = {
        "formatVersion": 2,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    layout.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="通过连接别名导出指定数据库的分类 DDL 结构快照。"
    )
    parser.add_argument("connection", nargs="?", help="connections.json 中的连接别名")
    parser.add_argument("database", nargs="?", help="本次要导出的数据库名")
    parser.add_argument(
        "--init",
        action="store_true",
        help="初始化项目根目录下固定的 .database-schema 连接配置",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    layout = build_layout(discover_project_root())
    if args.init:
        if args.connection or args.database:
            raise ConfigError("--init 不能同时提供连接别名或数据库名。")
        init_storage(layout)
        return 0

    if not args.connection or not args.database:
        raise ConfigError(
            "导出时必须同时提供连接别名和数据库名，"
            "例如：export_schema.py yuga res-v4"
        )

    redactor = SecretRedactor()
    raw_connections = read_config(layout.config)
    resolver = EnvironmentResolver(layout.root, redactor)
    raw = select_connection(raw_connections, args.connection)
    results: list[dict[str, Any]] = []
    alias = str(raw["alias"])
    try:
        connection = resolve_connection(raw, resolver, args.database)
        print(
            f"正在导出：{connection.alias}（{connection.engine}/{connection.database}）"
        )
        object_count = export_one(layout, connection, redactor)
        results.append(
            {
                "connectionAlias": connection.alias,
                "engine": connection.engine,
                "database": connection.database,
                "status": "complete",
                "objectCount": object_count,
            }
        )
        print(
            f"导出完成：{connection.alias}/{connection.database}，"
            f"共 {object_count} 个对象。"
        )
    except ExportError as exc:
        message = redactor.redact(str(exc))
        result = {
            "connectionAlias": alias,
            "database": args.database,
            "status": "failed",
            "error": message,
        }
        if isinstance(exc, ActionRequiredError):
            result["errorCode"] = exc.code
            result["actionRequired"] = exc.action
        results.append(result)
        print(
            f"导出失败：{alias}/{args.database}：{message}", file=sys.stderr
        )
    write_report(layout, results)
    return 0 if results[0]["status"] == "complete" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ExportError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        raise SystemExit(1)
