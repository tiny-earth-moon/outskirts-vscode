import { FixTarget, InvalidOutputError, parseResults, ScanResult } from "./results";

export interface ProcessRun {
  exitCode: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
}

export class ScanFailedError extends Error {
  readonly fixes: readonly FixTarget[];

  constructor(readonly run: ProcessRun, readonly stderrTail: string) {
    const hint = hintFor(stderrTail);
    super(`${exitDescription(run)}${stderrTail === "" ? "" : `\n${stderrTail}`}${hint === undefined ? "" : `\n${hint}`}`);
    this.fixes = hint === undefined ? [] : ["arguments", "configuration"];
  }
}

export function exitDescription(run: Pick<ProcessRun, "exitCode" | "signal">): string {
  return run.exitCode === null && typeof run.signal === "string"
    ? `outskirts was stopped by signal ${run.signal}.`
    : `outskirts exited with status ${String(run.exitCode)}.`;
}

const hints: readonly [string, string][] = [
  ["Failed to identify project", "Name the Xcode project or workspace with \"--project <name>\" in Extra arguments, or \"project:\" in .outskirts.yml."],
  ["'--schemes' option is required", "Name the schemes to build with \"--schemes <scheme>\" in Extra arguments, or \"schemes:\" in .outskirts.yml."],
];

function hintFor(stderr: string): string | undefined {
  return hints.find(([error]) => stderr.includes(error))?.[1];
}

export function interpretRun(run: ProcessRun): ScanResult[] {
  if (run.exitCode === 0) {
    return parseResults(run.stdout);
  }
  if (run.exitCode === 1 && run.stdout.trim() !== "") {
    try {
      return parseResults(run.stdout);
    } catch (error) {
      if (!(error instanceof InvalidOutputError)) {
        throw error;
      }
    }
  }
  throw new ScanFailedError(run, lastLines(run.stderr, 5));
}

export function lastLines(text: string, count: number): string {
  return text.trimEnd().split("\n").slice(-count).join("\n");
}
