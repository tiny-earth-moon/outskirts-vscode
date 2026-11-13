import { execFile } from "node:child_process";

export function probeAgent(executable: string, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(executable, ["--version"], { timeout, shell: false, windowsHide: true }, (error) => {
      resolve(error === null);
    });
  });
}
