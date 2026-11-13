import { InvalidOutputError, parseResults, ScanResult } from "./results";

export interface ProcessRun {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export class ScanFailedError extends Error {
  constructor(readonly exitCode: number | null, readonly stderrTail: string) {
    super(`outskirts exited with status ${String(exitCode)}.${stderrTail === "" ? "" : `\n${stderrTail}`}`);
  }
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
