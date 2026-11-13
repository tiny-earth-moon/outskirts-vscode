import { InvalidOutputError, parseResults, ScanResult } from "./results";

export interface ProcessRun {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export class ScanFailedError extends Error {
  constructor(readonly exitCode: number | null, readonly stderrTail: string) {
    super(`outskirts exited with status ${String(exitCode)}.${stderrTail === "" ? "" : `\n${stderrTail}`}${hintFor(stderrTail)}`);
  }
}

const hints: readonly [string, string][] = [
  ["Failed to identify project", "Name the Xcode project or workspace with \"--project <name>\" in Extra arguments, or \"project:\" in .outskirts.yml."],
  ["'--schemes' option is required", "Name the schemes to build with \"--schemes <scheme>\" in Extra arguments, or \"schemes:\" in .outskirts.yml."],
];

function hintFor(stderr: string): string {
  const hint = hints.find(([error]) => stderr.includes(error));
  return hint === undefined ? "" : `\n${hint[1]}`;
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
  throw new ScanFailedError(run.exitCode, lastLines(run.stderr, 5));
}

export function lastLines(text: string, count: number): string {
  return text.trimEnd().split("\n").slice(-count).join("\n");
}
