import { execFile } from "node:child_process";
import { currentSearchEnvironment, resolveOnPath } from "./commandPath";
import { ExecutableVersion } from "./optionsModel";
import { parseVersion } from "./version";

export function probeVersion(executable: string, cwd?: string, timeout = 5000): Promise<ExecutableVersion> {
  let command: string;
  try {
    command = resolveOnPath(executable, currentSearchEnvironment());
  } catch {
    return Promise.resolve({ state: "missing" });
  }
  return new Promise((resolve) => {
    execFile(command, ["version"], { cwd, timeout, shell: false }, (error, stdout) => {
      if (error !== null && error.killed === true) {
        resolve({ state: "unanswered" });
        return;
      }
      const version = error === null ? parseVersion(stdout) : undefined;
      resolve(version === undefined ? { state: "missing" } : { state: "found", version });
    });
  });
}
