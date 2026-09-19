import { checkbox, select } from "@inquirer/prompts";
import { databaseProviders } from "../providers/builtin.js";
import type { Engine } from "../types.js";

type ObjectScope = "all" | "common" | "advanced" | "custom";

export async function promptObjectTypes(engine: Engine): Promise<string[]> {
  const definitions = databaseProviders.get(engine).manifest.objects;
  const supported = definitions.map((object) => object.id);
  const common = new Set(
    definitions
      .filter((object) => object.category === "common")
      .map((object) => object.id),
  );
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
    choices: definitions.map((object) => ({
      name: object.displayName,
      value: object.id,
      checked: object.defaultSelected,
    })),
  });
}
