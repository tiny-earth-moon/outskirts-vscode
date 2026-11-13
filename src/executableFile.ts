import { accessSync, constants, statSync } from "node:fs";
import * as path from "node:path";

const defaultWindowsExtensions = [".COM", ".EXE", ".BAT", ".CMD"];

export function isExecutableFile(file: string, platform: NodeJS.Platform = process.platform, extensions: readonly string[] = executableExtensions(platform)): boolean {
  if (platform === "win32" && !hasExecutableExtension(file, extensions)) {
    return false;
  }
  try {
    if (!statSync(file).isFile()) {
      return false;
    }
    accessSync(file, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function executableExtensions(platform: NodeJS.Platform = process.platform, pathext: string | undefined = process.env.PATHEXT): string[] {
  if (platform !== "win32") {
    return [""];
  }
  const extensions = (pathext ?? "")
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => /^\.[^.\\/]+$/.test(extension));
  return extensions.length > 0 ? extensions : defaultWindowsExtensions;
}

export function hasExecutableExtension(file: string, extensions: readonly string[]): boolean {
  const extension = path.win32.extname(file).toUpperCase();
  return extension !== "" && extensions.some((candidate) => candidate.toUpperCase() === extension);
}
