import * as path from "node:path";

export interface SourcePosition {
  file: string;
  line: number;
  column: number;
}

export interface FolderAlias {
  readonly real: string;
  readonly shown: string;
}

export function parseLocation(location: string, folder: string, aliases: readonly FolderAlias[] = []): SourcePosition {
  const match = /^(.+):(\d+):(\d+)$/.exec(location);
  if (match === null) {
    throw new Error(`Unexpected result location '${location}'.`);
  }
  const [, file, line, column] = match;
  return {
    file: shownPath(path.isAbsolute(file) ? file : path.resolve(folder, file), aliases),
    line: Math.max(Number(line) - 1, 0),
    column: Math.max(Number(column) - 1, 0),
  };
}

export function shownPath(file: string, aliases: readonly FolderAlias[]): string {
  for (const alias of [...aliases].sort((a, b) => b.real.length - a.real.length)) {
    if (file === alias.real) {
      return alias.shown;
    }
    const prefix = alias.real.endsWith(path.sep) ? alias.real : alias.real + path.sep;
    if (file.startsWith(prefix)) {
      return path.join(alias.shown, file.slice(prefix.length));
    }
  }
  return file;
}
