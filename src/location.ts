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

export function utf16Column(line: string, byteColumn: number): number {
  let bytes = 0;
  let units = 0;
  for (const character of line) {
    if (bytes >= byteColumn) {
      return units;
    }
    bytes += Buffer.byteLength(character, "utf8");
    units += character.length;
  }
  return units + Math.max(byteColumn - bytes, 0);
}

export function isRelativeLocation(location: string): boolean {
  const file = /^(.+):\d+:\d+$/.exec(location)?.[1];
  return file !== undefined && !path.isAbsolute(file);
}

export function relativeResultsBase(folder: string, extra: readonly string[]): string {
  const projectRoot = path.resolve(folder, lastOption(extra, "--project-root") ?? ".");
  return path.resolve(projectRoot, lastOption(extra, "--relative-to") ?? ".");
}

function lastOption(extra: readonly string[], name: string): string | undefined {
  let value: string | undefined;
  for (let index = 0; index < extra.length && extra[index] !== "--"; index++) {
    const argument = extra[index];
    if (argument === name && index + 1 < extra.length) {
      value = extra[++index];
    } else if (argument.startsWith(`${name}=`)) {
      value = argument.slice(name.length + 1);
    }
  }
  return value;
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
