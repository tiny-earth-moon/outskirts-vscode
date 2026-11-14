export interface LineEdit {
  readonly line: number;
  readonly replace: boolean;
  readonly text: string;
}

const command = /^\s*\/\/\s*(?:outskirts|periphery):([\w:]+)(.*)$/;

function commandName(line: string | undefined): string | undefined {
  return line === undefined ? undefined : command.exec(line)?.[1];
}

function indentation(line: string): string {
  return /^\s*/.exec(line)?.[0] ?? "";
}

function declarationStart(lines: readonly string[], line: number): number {
  let start = line;
  while (start > 0 && lines[start - 1].trim().startsWith("@")) {
    start--;
  }
  return start;
}

function commandsAbove(lines: readonly string[], start: number): number[] {
  const found: number[] = [];
  for (let index = start - 1; index >= 0 && commandName(lines[index]) !== undefined; index--) {
    found.push(index);
  }
  return found;
}

export function ignoreDeclaration(lines: readonly string[], line: number, eol: string): LineEdit | undefined {
  const start = declarationStart(lines, line);
  if (commandsAbove(lines, start).some((index) => commandName(lines[index]) === "ignore")) {
    return undefined;
  }
  return { line: start, replace: false, text: `${indentation(lines[start])}// outskirts:ignore${eol}` };
}

function functionLine(lines: readonly string[], line: number): number | undefined {
  for (let index = line; index >= 0; index--) {
    if (/\b(?:func|init|subscript)\b/.test(lines[index])) {
      return index;
    }
  }
  return undefined;
}

export function ignoreParameter(lines: readonly string[], line: number, name: string, eol: string): LineEdit | undefined {
  const declaration = functionLine(lines, line);
  if (declaration === undefined) {
    return undefined;
  }
  const start = declarationStart(lines, declaration);
  const above = commandsAbove(lines, start);
  if (above.some((index) => commandName(lines[index]) === "ignore")) {
    return undefined;
  }
  const existing = above.find((index) => commandName(lines[index]) === "ignore:parameters");
  if (existing === undefined) {
    return { line: start, replace: false, text: `${indentation(lines[start])}// outskirts:ignore:parameters ${name}${eol}` };
  }
  const match = /^(\s*\/\/\s*(?:outskirts|periphery):ignore:parameters\s+)([^-]*?)(\s*(?:-.*)?)$/.exec(lines[existing]);
  if (match === null) {
    return undefined;
  }
  const names = match[2].split(",").map((part) => part.trim()).filter((part) => part !== "");
  if (names.includes(name)) {
    return undefined;
  }
  return { line: existing, replace: true, text: `${match[1]}${[...names, name].join(",")}${match[3]}` };
}

export function ignoreFile(lines: readonly string[], eol: string): LineEdit | undefined {
  let insertAt = 0;
  let inBlock = false;
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (inBlock) {
      inBlock = !trimmed.includes("*/");
      insertAt = index + 1;
    } else if (trimmed.startsWith("/*")) {
      inBlock = !trimmed.includes("*/", 2);
      insertAt = index + 1;
    } else if (trimmed.startsWith("//") && !trimmed.startsWith("///")) {
      if (commandName(trimmed) === "ignore:all") {
        return undefined;
      }
      insertAt = index + 1;
    } else if (trimmed !== "") {
      break;
    }
  }
  return { line: insertAt, replace: false, text: `// outskirts:ignore:all${eol}` };
}

export function splitLines(text: string): { lines: string[]; eol: string } {
  return { lines: text.split(/\r?\n/), eol: text.includes("\r\n") ? "\r\n" : "\n" };
}

export function unusedParameterName(message: string): string | undefined {
  return /^Unused parameter '(.+)'$/.exec(message)?.[1];
}
