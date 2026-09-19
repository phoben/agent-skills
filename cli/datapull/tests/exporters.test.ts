import { describe, expect, it } from "vitest";
import { stripMysqlDefiner } from "../src/exporters/mysql.js";
import { sanitizePgDump } from "../src/exporters/postgresql.js";
import {
  decodeSqlcmdOutput,
  isSqlServerCertificateError,
  sqlcmdQueryArguments,
  sqlcmdTrustArguments,
  sqlServerExportTimeoutMs,
} from "../src/exporters/sqlserver.js";
import { DataPullError } from "../src/core/errors.js";

describe("DDL 安全规范化", () => {
  it("移除 MySQL DEFINER 并改用调用者安全上下文", () => {
    const ddl = "CREATE DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `v` AS SELECT 1";
    const result = stripMysqlDefiner(ddl);
    expect(result).not.toMatch(/DEFINER=/u);
    expect(result).toContain("SQL SECURITY INVOKER");
  });

  it("移除 PostgreSQL 所有者、授权与表触发器语句", () => {
    const result = sanitizePgDump(
      "CREATE TABLE public.a (id integer);\nALTER TABLE public.a OWNER TO admin;\nGRANT SELECT ON public.a TO reader;\nCREATE INDEX a_idx ON public.a(id);\nCREATE TRIGGER a_trg AFTER INSERT ON public.a EXECUTE FUNCTION f();\n",
    );
    expect(result).toContain("CREATE TABLE");
    expect(result).toContain("CREATE INDEX");
    expect(result).not.toContain("OWNER TO");
    expect(result).not.toContain("GRANT SELECT");
    expect(result).not.toContain("CREATE TRIGGER");
  });

  it("仅在用户显式信任 SQL Server 证书时传递 sqlcmd -C", () => {
    expect(
      sqlcmdTrustArguments({
        tls: { encrypt: true, trustServerCertificate: false },
      }),
    ).toEqual([]);
    expect(
      sqlcmdTrustArguments({
        tls: { encrypt: true, trustServerCertificate: true },
      }),
    ).toEqual(["-C"]);
  });

  it("强制 sqlcmd 使用 UTF-8 输出，以便识别本地化错误", () => {
    const args = sqlcmdQueryArguments(
      {
        authMode: "password",
        host: "db.example.internal",
        port: 1433,
        username: "tester",
        tls: { encrypt: true, trustServerCertificate: false },
      },
      "master",
      "SELECT 1;",
    );

    expect(args).toContain("-f");
    expect(args[args.indexOf("-f") + 1]).toBe("65001");
  });

  it("把 SQL Server 中文证书链错误识别为可恢复的 TLS 故障", () => {
    const detail = decodeSqlcmdOutput(
      Uint8Array.from([
        83, 83, 76, 32, 204, 225, 185, 169, 179, 204, 208, 242, 58, 32, 214, 164, 202,
        233, 193, 180, 178, 187, 202, 220, 208, 197, 200, 206, 161, 163,
      ]),
      "stderr",
      "win32",
      "zh-CN",
    );
    const error = new DataPullError("DATABASE_CLIENT_FAILED", "sqlcmd 执行失败。", 1, {
      detail,
    });

    expect(detail).toBe("SSL 提供程序: 证书链不受信任。");
    expect(isSqlServerCertificateError(error)).toBe(true);
  });

  it("SQL Server 导出默认保留大库预算，并允许 CI 缩短诊断预算", () => {
    expect(sqlServerExportTimeoutMs(undefined)).toBe(900_000);
    expect(sqlServerExportTimeoutMs("180000")).toBe(180_000);
    expect(() => sqlServerExportTimeoutMs("invalid")).toThrow(/必须是正整数/u);
  });
});
