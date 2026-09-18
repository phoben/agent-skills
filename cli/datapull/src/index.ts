#!/usr/bin/env node

import { CommanderError } from "commander";
import { buildProgram } from "./cli/program.js";
import { asDataPullError, DataPullError } from "./core/errors.js";
import { Output } from "./core/output.js";
import { assertSupportedNode } from "./core/runtime.js";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
if (argv.includes("--no-color")) process.env.NO_COLOR = "1";
const program = buildProgram();
program.configureOutput({
  writeOut: (value) => {
    if (!json) process.stdout.write(value);
  },
  writeErr: (value) => {
    if (!json) process.stderr.write(value);
  },
});

try {
  assertSupportedNode();
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError && error.exitCode === 0) process.exitCode = 0;
  else {
    const normalized = normalizeCliError(error);
    new Output({ command: commandName(argv), json }).failure(
      normalized,
      errorContext(argv, normalized),
    );
    process.exitCode = normalized.exitCode;
  }
}

function normalizeCliError(error: unknown): DataPullError {
  if (error instanceof CommanderError) {
    return new DataPullError(
      error.code === "commander.help" ? "INVALID_ARGUMENT" : "INVALID_ARGUMENT",
      error.message,
      2,
    );
  }
  return asDataPullError(error);
}

function commandName(args: string[]): string {
  const positional = args.filter((value, index) => {
    if (value.startsWith("-")) return false;
    const previous = args[index - 1];
    return previous === undefined || previous.startsWith("-") === false;
  });
  return positional.slice(0, 3).join(" ") || "datapull";
}

function errorContext(args: string[], error: DataPullError): Record<string, unknown> {
  const details = error.details ?? {};
  const context: Record<string, unknown> = {};
  if (error.code === "OPERATION_CANCELLED") context.outputFilesChanged = false;
  for (const key of ["actionPlan", "installation", "manualRequired", "outputFilesChanged", "targets"] as const) {
    if (details[key] !== undefined) context[key] = details[key];
  }
  const connection = optionValue(args, "--connection");
  const database = optionValue(args, "--database");
  if (connection !== undefined) context.connectionAlias = connection;
  if (database !== undefined) context.database = database;
  return context;
}

function optionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : undefined;
}
