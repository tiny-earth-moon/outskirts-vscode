import { spawn } from "node:child_process";
import { ProcessRun } from "./outcome";

export class ExecutableNotFoundError extends Error {
  constructor(readonly executable: string) {
    super(`The outskirts executable '${executable}' was not found.`);
  }
}

export class CancelledError extends Error {}

export interface RunOptions {
  cwd: string;
  signal: AbortSignal;
  onOutput: (text: string) => void;
}

export function runProcess(executable: string, args: string[], options: RunOptions): Promise<ProcessRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd, signal: options.signal, shell: false, killSignal: "SIGTERM" });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
      options.onOutput(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.name === "AbortError") {
        reject(new CancelledError("The scan was cancelled."));
      } else if (error.code === "ENOENT") {
        reject(new ExecutableNotFoundError(executable));
      } else {
        reject(error);
      }
    });
    child.on("close", (exitCode) => {
      if (options.signal.aborted) {
        reject(new CancelledError("The scan was cancelled."));
        return;
      }
      options.onOutput(stdout);
      resolve({ exitCode, stdout, stderr });
    });
  });
}
