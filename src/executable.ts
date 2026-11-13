export interface PathSetting {
  defaultValue?: string;
  globalValue?: string;
  workspaceValue?: string;
  workspaceFolderValue?: string;
}

export function resolveExecutable(setting: PathSetting | undefined): string {
  const value = setting?.globalValue ?? setting?.defaultValue ?? "outskirts";
  if (value.trim() === "") {
    throw new Error("The setting outskirts.path is empty.");
  }
  return value;
}
