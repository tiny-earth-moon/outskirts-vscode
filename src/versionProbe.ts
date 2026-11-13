import { execFile } from "node:child_process";
import { ExecutableVersion } from "./optionsModel";
import { parseVersion } from "./version";

export function probeVersion(executable: string, timeout = 5000): Promise<ExecutableVersion> {
  return new Promise((resolve) => {
    execFile(executable, ["version"], { timeout, shell: false }, (error, stdout) => {
      const version = error === null ? parseVersion(stdout) : undefined;
      resolve(version === undefined ? { state: "missing" } : { state: "found", version });
    });
  });
}
