import { CheckResult } from "./configMessages";

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function parseCheck(exitCode: number | null, output: string, file: string): CheckResult {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp(`^(?:(?:warning|error|note):\\s*)?${escaped}:\\s*`);
  const lines = output
    .replace(ansi, "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(prefix, ""))
    .filter((line) => line !== "" && line !== "ok" && !/^\d+ problems? found\.?$/.test(line));
  if (exitCode === 0) {
    return { state: "valid", messages: lines };
  }
  if (exitCode === 1) {
    return { state: "problems", messages: lines.length > 0 ? lines : ["outskirts config check found a problem but printed nothing."] };
  }
  return {
    state: "unavailable",
    messages: [`outskirts config check did not run to completion${exitCode === null ? "" : ` (status ${String(exitCode)})`}.`, ...lines],
  };
}
