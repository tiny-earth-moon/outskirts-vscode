import { accessSync, constants, statSync } from "node:fs";

export function isExecutableFile(file: string): boolean {
  try {
    if (!statSync(file).isFile()) {
      return false;
    }
    accessSync(file, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function executableExtensions(): string[] {
  if (process.platform !== "win32") {
    return [""];
  }
  return ["", ...(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((extension) => extension !== "")];
}
