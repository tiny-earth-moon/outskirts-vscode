import { homedir } from "node:os";
import { join } from "node:path";

export interface PathSetting {
  defaultValue?: string;
  globalValue?: string;
  workspaceValue?: string;
  workspaceFolderValue?: string;
}

export function resolveExecutable(setting: PathSetting | undefined, home: string = homedir()): string {
  const value = setting?.globalValue ?? setting?.defaultValue ?? "outskirts";
  if (value.trim() === "") {
    throw new Error("The setting outskirts.path is empty.");
  }
  return expandHome(value, home);
}

function expandHome(value: string, home: string): string {
  if (value === "~") {
    return home;
  }
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return join(home, value.slice(2));
  }
  return value;
}
