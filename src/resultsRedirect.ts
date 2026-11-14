import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { isMap, isScalar, parseDocument } from "yaml";
import { readConfigFile } from "./baselineConfig";
import { FixTarget } from "./results";

export function argumentsRedirect(extra: readonly string[]): boolean {
  let skipped = false;
  for (const argument of extra) {
    if (argument === "--skip-stdout-results") {
      skipped = true;
    } else if (argument === "--no-skip-stdout-results") {
      skipped = false;
    }
  }
  return skipped || extra.some((argument) => argument === "--write-results" || argument.startsWith("--write-results="));
}

export function configurationRedirect(configText: string): boolean {
  const document = parseDocument(configText);
  const error = document.errors.at(0);
  if (error !== undefined) {
    throw new Error(`The configuration file is not valid YAML: ${error.message}`);
  }
  if (!isMap(document.contents)) {
    return false;
  }
  const skip: unknown = document.contents.get("skip_stdout_results", true);
  if (isScalar(skip) && skip.value === true) {
    return true;
  }
  const write: unknown = document.contents.get("write_results", true);
  return isScalar(write) && (typeof write.value === "string" ? write.value.trim() !== "" : typeof write.value === "number");
}

export function configArgument(extra: readonly string[]): string | undefined {
  let configured: string | undefined;
  extra.forEach((argument, index) => {
    if (argument === "--config" && index + 1 < extra.length) {
      configured = extra[index + 1];
    } else if (argument.startsWith("--config=")) {
      configured = argument.slice("--config=".length);
    }
  });
  return configured;
}

export function redirectSources(extra: readonly string[], configText: string | undefined): FixTarget[] {
  return [
    ...(argumentsRedirect(extra) ? (["arguments"] as const) : []),
    ...(configText !== undefined && configurationRedirect(configText) ? (["configuration"] as const) : []),
  ];
}

export async function readScanConfig(cwd: string, extra: readonly string[]): Promise<string | undefined> {
  const configured = configArgument(extra);
  if (configured === undefined) {
    return (await readConfigFile(cwd)).text;
  }
  return readFile(path.resolve(cwd, configured), "utf8");
}
