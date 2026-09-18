import { describe, expect, it } from "vitest";
import { parseDotenv, serializeDotenv } from "../src/config/dotenv.js";

describe("credentials.env", () => {
  it("解析注释、引号和普通值", () => {
    const values = parseDotenv('# 本地凭证\nDB_PASSWORD="a\\nb"\nURL=postgres://user:pass@db/app # comment\n');
    expect(values.get("DB_PASSWORD")).toBe("a\nb");
    expect(values.get("URL")).toBe("postgres://user:pass@db/app");
  });

  it("序列化后可无损读取", () => {
    const source = new Map([
      ["B", "quote\"value"],
      ["A", "line\nvalue"],
    ]);
    expect(parseDotenv(serializeDotenv(source))).toEqual(source);
  });
});
