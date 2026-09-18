import { DataPullError } from "./errors.js";

export const MINIMUM_NODE_VERSION = [22, 12, 0] as const;

export function assertSupportedNode(version = process.versions.node): void {
  const current = version.split(".").map((part) => Number.parseInt(part, 10));
  const supported = MINIMUM_NODE_VERSION.every((minimum, index) => {
    const value = current[index] ?? 0;
    const prefixEqual = MINIMUM_NODE_VERSION.slice(0, index).every(
      (prefix, prefixIndex) => (current[prefixIndex] ?? 0) === prefix,
    );
    return !prefixEqual || value >= minimum;
  });
  if (!supported) {
    throw new DataPullError(
      "NODE_VERSION_UNSUPPORTED",
      `DataPull 需要 Node.js >= ${MINIMUM_NODE_VERSION.join(".")}，当前版本为 ${version}。`,
      4,
      { currentVersion: version, minimumVersion: MINIMUM_NODE_VERSION.join(".") },
    );
  }
}
