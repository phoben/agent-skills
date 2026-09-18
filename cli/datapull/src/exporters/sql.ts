export function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function quoteMysqlIdentifier(value: string): string {
  return `\`${value.replaceAll("`", "``")}\``;
}

export function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function ensureStatement(ddl: string, delimiter = false): string {
  const trimmed = ddl.trim().replace(/;+$/u, "");
  return delimiter ? `DELIMITER $$\n${trimmed}$$\nDELIMITER ;\n` : `${trimmed};\n`;
}
