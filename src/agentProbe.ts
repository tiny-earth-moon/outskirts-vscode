import { execFile } from "node:child_process";

export function probeAgent(executable: string, timeout = 5000, prefix: readonly string[] = []): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(executable, [...prefix, "--version"], { timeout, shell: false, windowsHide: true }, (error) => {
      resolve(error === null);
    });
  });
}
