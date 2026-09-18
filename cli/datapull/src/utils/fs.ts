import { constants } from "node:fs";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function atomicWriteFile(
  path: string,
  content: string,
  mode?: number,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, {
    encoding: "utf8",
    ...(mode === undefined ? {} : { mode }),
  });
  try {
    await rename(temporary, path);
  } catch (error) {
    if (!(await pathExists(path))) throw error;
    const previous = `${path}.${randomUUID()}.previous`;
    await rename(path, previous);
    try {
      await rename(temporary, path);
      await rm(previous, { force: true });
    } catch (replaceError) {
      if (await pathExists(previous)) await rename(previous, path);
      throw replaceError;
    }
  } finally {
    await rm(temporary, { force: true });
  }
}
