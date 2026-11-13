import * as path from "node:path";
import { executableExtensions, isExecutableFile } from "./executableFile";

export class ExecutableNotFoundError extends Error {
  constructor(readonly executable: string) {
    super(`The outskirts executable '${executable}' was not found.`);
  }
}

export interface SearchEnvironment {
  platform: NodeJS.Platform;
  pathVariable: string | undefined;
  extensions: readonly string[];
  exists: (file: string) => boolean;
}

export function resolveOnPath(executable: string, environment: SearchEnvironment): string {
  const paths = environment.platform === "win32" ? path.win32 : path.posix;
  if (paths.isAbsolute(executable)) {
    return executable;
  }
  if (executable.includes("/") || executable.includes("\\")) {
    throw new ExecutableNotFoundError(executable);
  }
  const directories = (environment.pathVariable ?? "")
    .split(paths.delimiter)
    .map((directory) => directory.replace(/^"(.*)"$/, "$1"))
    .filter((directory) => directory !== "" && paths.isAbsolute(directory));
  for (const directory of directories) {
    for (const extension of environment.extensions) {
      const candidate = paths.join(directory, executable + extension);
      if (environment.exists(candidate)) {
        return candidate;
      }
    }
  }
  throw new ExecutableNotFoundError(executable);
}

export function currentSearchEnvironment(): SearchEnvironment {
  return { platform: process.platform, pathVariable: process.env.PATH, extensions: executableExtensions(), exists: isExecutableFile };
}
