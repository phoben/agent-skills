import type { Engine } from "../types.js";

export const OBJECT_TYPES: Record<Engine, readonly string[]> = {
  mysql: ["table", "view", "function", "procedure", "trigger", "event"],
  postgresql: [
    "schema",
    "extension",
    "table",
    "view",
    "materialized_view",
    "sequence",
    "function",
    "procedure",
    "trigger",
    "type",
  ],
  sqlserver: [
    "schema",
    "table",
    "view",
    "function",
    "procedure",
    "trigger",
    "sequence",
    "synonym",
    "type",
  ],
};

export function commonObjectTypes(engine: Engine): readonly string[] {
  return engine === "mysql"
    ? ["table", "view", "function", "procedure"]
    : ["schema", "table", "view", "function", "procedure"];
}
