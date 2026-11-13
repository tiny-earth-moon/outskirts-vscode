import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { currentSearchEnvironment, ExecutableNotFoundError, resolveOnPath, SearchEnvironment } from "./commandPath";
import { ProcessRun } from "./outcome";

export { ExecutableNotFoundError };

export class WorkingDirectoryNotFoundError extends Error {
  constructor(readonly cwd: string) {
    super(`The folder '${cwd}' to scan in does not exist.`);
  }
}

export class CancelledError extends Error {}

export interface RunOptions {
  cwd: string;
  signal: AbortSignal;
  onOutput: (text: string) => void;
  search?: SearchEnvironment;
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function runProcess(executable: string, args: string[], options: RunOptions): Promise<ProcessRun> {
  return new Promise((resolve, reject) => {
    const command = resolveOnPath(executable, options.search ?? currentSearchEnvironment());
    const child = spawn(command, args, { cwd: options.cwd, signal: options.signal, shell: false, killSignal: "SIGTERM" });
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
        reject(isDirectory(options.cwd) ? new ExecutableNotFoundError(executable) : new WorkingDirectoryNotFoundError(options.cwd));
      } else {
        reject(error);
      }
    });
    child.on("close", (exitCode, signal) => {
      if (options.signal.aborted) {
        reject(new CancelledError("The scan was cancelled."));
        return;
      }
      options.onOutput(`Read ${String(Buffer.byteLength(stdout))} bytes of results from stdout.\n`);
      resolve({ exitCode, signal, stdout, stderr });
    });
  });
}
