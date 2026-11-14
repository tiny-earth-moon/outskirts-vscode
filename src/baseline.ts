import * as path from "node:path";
import { isMap, isScalar, parseDocument } from "yaml";
import { ConfigOption } from "./configSchema";

export const defaultBaselineFile = ".outskirts-baseline.json";

export const baselineOption: ConfigOption = { key: "baseline", section: "", description: "", kind: "string", defaultValue: undefined };

export function configuredBaseline(configText: string): string | undefined {
  const document = parseDocument(configText);
  const error = document.errors.at(0);
  if (error !== undefined) {
    throw new Error(`The configuration file is not valid YAML: ${error.message}`);
  }
  if (!isMap(document.contents)) {
    return undefined;
  }
  const value = document.contents.get("baseline", true);
  if (!isScalar(value) || (typeof value.value !== "string" && typeof value.value !== "number")) {
    return undefined;
  }
  const text = String(value.value).trim();
  return text === "" ? undefined : text;
}

export function baselinePath(root: string, configured: string | undefined): string {
  return path.resolve(root, configured ?? defaultBaselineFile);
}

export function configValue(root: string, file: string): string {
  const relative = path.relative(root, file);
  return relative.startsWith("..") || path.isAbsolute(relative) ? file : relative.split(path.sep).join("/");
}

export function acceptArguments(file: string): string[] {
  return ["--write-baseline", file];
}

export function usesBaseline(configured: string | undefined, extra: readonly string[]): boolean {
  return configured !== undefined || extra.some((argument) => argument === "--baseline" || argument.startsWith("--baseline="));
}

export function withBaseline(text: string, baselined: boolean): string {
  return baselined ? `${text} · baseline` : text;
}

export function newSinceBaselineText(total: number, baselined: boolean): string | undefined {
  return baselined ? `${String(total)} new since baseline` : undefined;
}
