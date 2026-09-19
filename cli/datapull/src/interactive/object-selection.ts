import { checkbox, select } from "@inquirer/prompts";
import { commonObjectTypes, OBJECT_TYPES } from "../exporters/objects.js";
import type { Engine } from "../types.js";

type ObjectScope = "all" | "common" | "advanced" | "custom";

const DEFAULT_CUSTOM_OBJECT_TYPES = new Set(["table", "view", "function"]);

const OBJECT_TYPE_LABELS: Readonly<Record<string, string>> = {
  schema: "模式(Schema)",
  extension: "扩展(Extension)",
  table: "数据表(Table)",
  view: "视图(View)",
  materialized_view: "物化视图(Materialized View)",
  sequence: "序列(Sequence)",
  function: "函数(Function)",
  procedure: "存储过程(Procedure)",
  trigger: "触发器(Trigger)",
  event: "事件(Event)",
  synonym: "同义词(Synonym)",
  type: "类型(Type)",
};

export async function promptObjectTypes(engine: Engine): Promise<string[]> {
  const supported = [...OBJECT_TYPES[engine]];
  const common = new Set(commonObjectTypes(engine));
  const scope = await select<ObjectScope>({
    message: "选择数据库对象拉取范围：",
    default: "common",
    loop: false,
    choices: [
      { name: "全部对象", value: "all" },
      { name: "常用对象", value: "common" },
      { name: "高级对象", value: "advanced" },
      { name: "自定义", value: "custom" },
    ],
  });

  if (scope === "all") return supported;
  if (scope === "common") return supported.filter((type) => common.has(type));
  if (scope === "advanced") return supported.filter((type) => !common.has(type));

  return checkbox<string>({
    message: "选择要拉取的数据库对象：",
    required: true,
    loop: false,
    pageSize: supported.length,
    choices: supported.map((type) => ({
      name: OBJECT_TYPE_LABELS[type] ?? type,
      value: type,
      checked: DEFAULT_CUSTOM_OBJECT_TYPES.has(type),
    })),
  });
}
