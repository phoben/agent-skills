import { describe, expect, it } from "vitest";
import { stripMysqlDefiner } from "../src/exporters/mysql.js";
import { sanitizePgDump } from "../src/exporters/postgresql.js";
import { sqlcmdTrustArguments } from "../src/exporters/sqlserver.js";

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
});
