import * as path from "node:path";

export interface SourcePosition {
  file: string;
  line: number;
  column: number;
}

export function parseLocation(location: string, folder: string): SourcePosition {
  const match = /^(.+):(\d+):(\d+)$/.exec(location);
  if (match === null) {
    throw new Error(`Unexpected result location '${location}'.`);
  }
  const [, file, line, column] = match;
  return {
    file: path.isAbsolute(file) ? file : path.resolve(folder, file),
    line: Math.max(Number(line) - 1, 0),
    column: Math.max(Number(column) - 1, 0),
  };
}
