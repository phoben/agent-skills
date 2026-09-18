import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "export_schema.py"
SPEC = importlib.util.spec_from_file_location("database_schema_export", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class DatabaseSchemaExportTests(unittest.TestCase):
    def test_parse_dotenv_supports_common_values_without_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text(
                "PLAIN=value\nSINGLE='a # b'\nDOUBLE=\"line\\nnext\"\n"
                "COMMENTED=value # note\nexport EXPORTED=yes\n",
                encoding="utf-8",
            )
            values = MODULE.parse_dotenv(path)
        self.assertEqual(values["PLAIN"], "value")
        self.assertEqual(values["SINGLE"], "a # b")
        self.assertEqual(values["DOUBLE"], "line\nnext")
        self.assertEqual(values["COMMENTED"], "value")
        self.assertEqual(values["EXPORTED"], "yes")

    def test_environment_priority_is_process_then_local_then_base(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env").write_text("DB_NAME=base\n", encoding="utf-8")
            (root / ".env.local").write_text("DB_NAME=local\n", encoding="utf-8")
            redactor = MODULE.SecretRedactor()
            with mock.patch.dict(os.environ, {"DB_NAME": "process"}, clear=True):
                resolver = MODULE.EnvironmentResolver(root, redactor)
                resolved = resolver.resolve("DB_NAME", secret=False)
            self.assertEqual(resolved.value, "process")
            self.assertEqual(resolved.source, "process")

    def test_secret_dotenv_must_be_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / ".env.local").write_text(
                "DB_PASSWORD=secret-value\n", encoding="utf-8"
            )
            redactor = MODULE.SecretRedactor()
            clean_environment = {"PATH": os.environ.get("PATH", "")}
            with mock.patch.dict(os.environ, clean_environment, clear=True):
                resolver = MODULE.EnvironmentResolver(root, redactor)
                with self.assertRaises(MODULE.SecurityError):
                    resolver.resolve("DB_PASSWORD", secret=True)
            (root / ".gitignore").write_text(".env.local\n", encoding="utf-8")
            with mock.patch.dict(os.environ, clean_environment, clear=True):
                resolver = MODULE.EnvironmentResolver(root, MODULE.SecretRedactor())
                resolved = resolver.resolve("DB_PASSWORD", secret=True)
            self.assertEqual(resolved.value, "secret-value")

    def test_plaintext_password_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "connections.json"
            path.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "connections": [
                            {
                                "alias": "bad",
                                "engine": "postgresql",
                                "password": "secret",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaises(MODULE.SecurityError):
                MODULE.read_config(path)

    def test_composite_plaintext_secret_field_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "connections.json"
            path.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "connections": [
                            {
                                "alias": "bad",
                                "engine": "postgresql",
                                "databasePassword": "hidden",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaises(MODULE.SecurityError):
                MODULE.read_config(path)

    def test_short_secret_is_redacted(self):
        redactor = MODULE.SecretRedactor()
        redactor.add("ab")
        self.assertEqual(redactor.redact("failure ab"), "failure ***")

    def test_nested_plaintext_secret_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "connections.json"
            path.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "connections": [
                            {
                                "alias": "bad",
                                "engine": "postgresql",
                                "host": {"password": "hidden"},
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaises(MODULE.SecurityError):
                MODULE.read_config(path)

    def test_connection_selection_uses_exact_alias(self):
        connections = [{"alias": "orders"}, {"alias": "app"}]
        selected = MODULE.select_connection(connections, "APP")
        self.assertEqual(selected["alias"], "app")

    def test_database_field_is_rejected_from_connection_config(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "connections.json"
            path.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "connections": [
                            {
                                "alias": "main",
                                "engine": "postgresql",
                                "database": "app",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaises(MODULE.ConfigError):
                MODULE.read_config(path)

    def test_version_one_config_reports_migration_action(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "connections.json"
            path.write_text(
                json.dumps({"version": 1, "connections": []}), encoding="utf-8"
            )
            with self.assertRaisesRegex(MODULE.ConfigError, "keyword 改为 alias"):
                MODULE.read_config(path)

    def test_database_name_must_be_safe_directory_component(self):
        raw = {
            "alias": "main",
            "engine": "postgresql",
            "host": "localhost",
            "username": "reader",
        }
        with tempfile.TemporaryDirectory() as directory:
            resolver = MODULE.EnvironmentResolver(
                Path(directory), MODULE.SecretRedactor()
            )
            with self.assertRaisesRegex(MODULE.ConfigError, "数据库名.*不能安全用于目录名"):
                MODULE.resolve_connection(raw, resolver, "../orders")

    def test_url_environment_resolves_connection_without_leaking_password(self):
        raw = {"alias": "main", "engine": "postgresql", "urlEnv": "DATABASE_URL"}
        redactor = MODULE.SecretRedactor()
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.dict(
                os.environ,
                {
                    "DATABASE_URL": "postgresql+psycopg://user:top-secret@db.example:5433/app?sslmode=require"
                },
                clear=True,
            ):
                resolver = MODULE.EnvironmentResolver(Path(directory), redactor)
                connection = MODULE.resolve_connection(raw, resolver, "target_db")
        self.assertEqual(connection.host, "db.example")
        self.assertEqual(connection.port, 5433)
        self.assertEqual(connection.database, "target_db")
        self.assertEqual(connection.username, "user")
        self.assertEqual(connection.password, "top-secret")
        self.assertEqual(connection.ssl_mode, "require")
        self.assertNotIn("top-secret", redactor.redact("failure top-secret"))

    def test_string_boolean_is_rejected(self):
        raw = {
            "alias": "main",
            "engine": "postgresql",
            "host": "localhost",
            "username": "reader",
            "encrypt": "false",
        }
        with tempfile.TemporaryDirectory() as directory:
            resolver = MODULE.EnvironmentResolver(
                Path(directory), MODULE.SecretRedactor()
            )
            with self.assertRaises(MODULE.ConfigError):
                MODULE.resolve_connection(raw, resolver, "app")

    def test_sqlserver_defaults_to_encrypted_validated_connection(self):
        raw = {
            "alias": "main",
            "engine": "sqlserver",
            "host": "db.example",
            "authentication": "integrated",
        }
        with tempfile.TemporaryDirectory() as directory:
            resolver = MODULE.EnvironmentResolver(
                Path(directory), MODULE.SecretRedactor()
            )
            connection = MODULE.resolve_connection(raw, resolver, "app")
        self.assertTrue(connection.encrypt)
        self.assertFalse(connection.trust_server_certificate)

    def test_sqlserver_untrusted_certificate_failure_requires_user_action(self):
        connection = MODULE.Connection(
            alias="main",
            engine="sqlserver",
            host="db.example",
            port=1433,
            database="app",
            username="reader",
            password="secret",
            timeout=120,
            authentication="password",
            ssl_mode=None,
            encrypt=True,
            trust_server_certificate=False,
        )
        cli_error = MODULE.DatabaseCliError(1, "证书链是由不受信任的颁发机构颁发的。")
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            MODULE, "require_tools", return_value={"sqlcmd": "sqlcmd"}
        ), mock.patch.object(
            MODULE.shutil, "which", return_value="pwsh"
        ), mock.patch.object(
            MODULE, "run_command", side_effect=cli_error
        ):
            exporter = MODULE.SQLServerExporter(connection, MODULE.SecretRedactor())
            with self.assertRaises(MODULE.ActionRequiredError) as raised:
                exporter.export(Path(directory))
        self.assertEqual(raised.exception.code, "SQLSERVER_TLS_CERTIFICATE_UNTRUSTED")
        self.assertEqual(
            raised.exception.action,
            "repair-certificate-or-confirm-trust-server-certificate",
        )

    def test_sqlserver_full_export_uses_extended_timeout(self):
        connection = MODULE.Connection(
            alias="main",
            engine="sqlserver",
            host="db.example",
            port=1433,
            database="app",
            username="reader",
            password="secret",
            timeout=120,
            authentication="password",
            ssl_mode=None,
            encrypt=True,
            trust_server_certificate=True,
        )
        observed_timeouts = []
        with tempfile.TemporaryDirectory() as directory:
            staging = Path(directory)

            def fake_run_command(_args, **kwargs):
                observed_timeouts.append(kwargs["timeout"])
                if len(observed_timeouts) == 2:
                    (staging / "objects.json").write_text("[]\n", encoding="utf-8")
                return ""

            with mock.patch.object(
                MODULE, "require_tools", return_value={"sqlcmd": "sqlcmd"}
            ), mock.patch.object(
                MODULE.shutil, "which", return_value="pwsh"
            ), mock.patch.object(
                MODULE, "run_command", side_effect=fake_run_command
            ):
                records = MODULE.SQLServerExporter(
                    connection, MODULE.SecretRedactor()
                ).export(staging)
        self.assertEqual(records, [])
        self.assertEqual(observed_timeouts, [120, 900])

    def test_sqlserver_manifest_discloses_connection_security(self):
        connection = MODULE.Connection(
            alias="main",
            engine="sqlserver",
            host="db.example",
            port=1433,
            database="app",
            username="reader",
            password="secret",
            timeout=120,
            authentication="password",
            ssl_mode=None,
            encrypt=True,
            trust_server_certificate=True,
        )
        with tempfile.TemporaryDirectory() as directory:
            staging = Path(directory)
            MODULE.write_manifest(staging, connection, [])
            manifest = json.loads(
                (staging / "manifest.json").read_text(encoding="utf-8")
            )
        self.assertEqual(
            manifest["connectionSecurity"],
            {"encrypted": True, "serverCertificateValidated": False},
        )

    def test_sqlserver_record_list_serializes_as_json_array(self):
        powershell = shutil.which("pwsh") or shutil.which("powershell")
        if not powershell:
            self.skipTest("当前环境没有 PowerShell。")
        common_script = SCRIPT_PATH.parent / "sqlserver_common.ps1"
        with tempfile.TemporaryDirectory() as directory:
            harness = Path(directory) / "record-json-test.ps1"
            harness.write_text(
                "$ErrorActionPreference = 'Stop'\n"
                ". $args[0]\n"
                "$records = New-Object System.Collections.Generic.List[object]\n"
                "$records.Add([pscustomobject]@{ object_type = 'table'; name = 'sample' })\n"
                "$json = ConvertTo-RecordJson -Records $records\n"
                "if (-not $json.TrimStart().StartsWith('[')) { throw 'JSON 不是数组。' }\n"
                "$parsed = ConvertFrom-Json -InputObject $json\n"
                "if (@($parsed).Count -ne 1 -or @($parsed)[0].name -ne 'sample') { throw 'JSON 内容错误。' }\n"
                "Write-Output 'ok'\n",
                encoding="utf-8",
            )
            result = subprocess.run(
                [powershell, "-NoLogo", "-NoProfile", "-File", harness, common_script],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "ok")

    def test_safe_file_name_is_stable_and_distinguishes_overloads(self):
        first = MODULE.safe_file_stem("public.calculate(integer)")
        second = MODULE.safe_file_stem("public.calculate(text)")
        self.assertEqual(first, MODULE.safe_file_stem("public.calculate(integer)"))
        self.assertNotEqual(first, second)
        self.assertNotRegex(first, r'[<>:"/\\|?*]')

    def test_atomic_replacement_removes_stale_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "schemas" / "main"
            target.mkdir(parents=True)
            (target / "stale.sql").write_text("old", encoding="utf-8")
            staging = root / ".tmp" / "new"
            staging.mkdir(parents=True)
            (staging / "fresh.sql").write_text("new", encoding="utf-8")
            MODULE.replace_snapshot(staging, target)
            self.assertFalse((target / "stale.sql").exists())
            self.assertEqual((target / "fresh.sql").read_text(encoding="utf-8"), "new")
            self.assertFalse(staging.exists())

    def test_mysql_definer_is_removed(self):
        ddl = "CREATE DEFINER=`admin`@`%` SQL SECURITY DEFINER VIEW `v` AS SELECT 1"
        cleaned = MODULE._strip_mysql_definer(ddl)
        self.assertNotIn("admin", cleaned)
        self.assertIn("SQL SECURITY DEFINER", cleaned)

    def test_init_storage_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            layout = MODULE.build_layout(Path(directory))
            MODULE.init_storage(layout)
            original = layout.config.read_text(encoding="utf-8")
            layout.config.write_text(original + "\n", encoding="utf-8")
            MODULE.init_storage(layout)
            self.assertEqual(layout.config.read_text(encoding="utf-8"), original + "\n")
            self.assertIn(
                "connections.json",
                (layout.storage / ".gitignore").read_text(encoding="utf-8"),
            )

    def test_same_connection_keeps_database_snapshots_isolated(self):
        class FakeExporter:
            def export(self, staging):
                return [
                    MODULE.write_object(
                        staging,
                        "table",
                        "public.orders",
                        "CREATE TABLE orders (id int);",
                        schema="public",
                        name="orders",
                    )
                ]

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            layout = MODULE.build_layout(root)
            layout.storage.mkdir()
            layout.config.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "connections": [
                            {
                                "alias": "main",
                                "engine": "postgresql",
                                "host": "localhost",
                                "username": "reader",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            with mock.patch.object(
                MODULE, "discover_project_root", return_value=root
            ), mock.patch.object(
                MODULE, "exporter_for", return_value=FakeExporter()
            ):
                first_exit_code = MODULE.main(["main", "orders"])
                second_exit_code = MODULE.main(["main", "billing"])

            self.assertEqual(first_exit_code, 0)
            self.assertEqual(second_exit_code, 0)
            self.assertTrue(
                (layout.schemas / "main" / "orders" / "manifest.json").is_file()
            )
            self.assertTrue(
                (layout.schemas / "main" / "billing" / "manifest.json").is_file()
            )

    def test_failed_export_preserves_existing_database_snapshot(self):
        class FailingExporter:
            def export(self, _staging):
                raise MODULE.ExportError("模拟失败")

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            layout = MODULE.build_layout(root)
            layout.storage.mkdir()
            layout.config.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "connections": [
                            {
                                "alias": "main",
                                "engine": "postgresql",
                                "host": "localhost",
                                "username": "reader",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            old_snapshot = layout.schemas / "main" / "orders"
            old_snapshot.mkdir(parents=True)
            (old_snapshot / "old.sql").write_text("old", encoding="utf-8")

            with mock.patch.object(
                MODULE, "discover_project_root", return_value=root
            ), mock.patch.object(
                MODULE, "exporter_for", return_value=FailingExporter()
            ):
                exit_code = MODULE.main(["main", "orders"])

            self.assertEqual(exit_code, 1)
            self.assertTrue((old_snapshot / "old.sql").is_file())
            report = json.loads(layout.report.read_text(encoding="utf-8"))
            self.assertEqual(report["results"][0]["connectionAlias"], "main")
            self.assertEqual(report["results"][0]["database"], "orders")
            self.assertEqual(report["results"][0]["status"], "failed")

    def test_action_required_error_is_structured_in_run_report(self):
        class ActionRequiredExporter:
            def export(self, _staging):
                raise MODULE.ActionRequiredError(
                    "需要处理证书。",
                    code="SQLSERVER_TLS_CERTIFICATE_UNTRUSTED",
                    action="repair-certificate-or-confirm-trust-server-certificate",
                )

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            layout = MODULE.build_layout(root)
            layout.storage.mkdir()
            layout.config.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "connections": [
                            {
                                "enabled": True,
                                "alias": "main",
                                "engine": "sqlserver",
                                "host": "db.example",
                                "authentication": "integrated",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            with mock.patch.object(
                MODULE, "discover_project_root", return_value=root
            ), mock.patch.object(
                MODULE,
                "exporter_for",
                return_value=ActionRequiredExporter(),
            ):
                exit_code = MODULE.main(["main", "app"])

            report = json.loads(layout.report.read_text(encoding="utf-8"))
        self.assertEqual(exit_code, 1)
        self.assertEqual(
            report["results"][0]["errorCode"],
            "SQLSERVER_TLS_CERTIFICATE_UNTRUSTED",
        )
        self.assertEqual(
            report["results"][0]["actionRequired"],
            "repair-certificate-or-confirm-trust-server-certificate",
        )


if __name__ == "__main__":
    unittest.main()
