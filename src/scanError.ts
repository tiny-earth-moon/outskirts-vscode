import { ExecutableNotFoundError } from "./commandPath";
import { installHint } from "./optionsModel";
import { ScanFailedError } from "./outcome";
import { FixTarget, InvalidOutputError } from "./results";

export interface ScanError {
  message: string;
  fixes: readonly FixTarget[];
}

export interface ErrorNodeFields {
  label: string;
  description: string;
  tooltip: string;
}

export const fixCommands: Record<FixTarget, { label: string; command: string; arguments: (key: string) => unknown[] }> = {
  arguments: { label: "Edit Extra arguments", command: "workbench.action.openSettings", arguments: () => ["outskirts.arguments"] },
  configuration: { label: "Edit the configuration file", command: "outskirts.editConfiguration", arguments: (key) => [{ key }] },
};

export function scanError(error: unknown): ScanError {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ExecutableNotFoundError) {
    return { message: `${message} ${installHint}`, fixes: [] };
  }
  if (error instanceof InvalidOutputError || error instanceof ScanFailedError) {
    return { message, fixes: error.fixes };
  }
  return { message, fixes: [] };
}

export function firstSentence(message: string): string {
  const line = message.trim().split("\n")[0];
  const end = /[.!?](\s|$)/.exec(line);
  return end === null ? line : line.slice(0, end.index + 1);
}

export function errorNodeFields(error: ScanError): ErrorNodeFields {
  return { label: firstSentence(error.message), description: "scan failed", tooltip: error.message };
}

export function errorContextValue(error: ScanError): string {
  return error.fixes.length > 0 ? "scanError.fixable" : "scanError";
}

export function failureToast(project: string): string {
  return `outskirts: scan of ${project} failed`;
}

export function wrappedMarkdown(message: string): string {
  return message
    .trim()
    .split("\n")
    .map((line) => line.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, "\\$&"))
    .join("  \n");
}
