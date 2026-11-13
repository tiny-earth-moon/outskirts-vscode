import * as path from "node:path";
import { AgentDefinition } from "./agents";
import { hasExecutableExtension } from "./executableFile";

export type ExistsPredicate = (file: string) => boolean;

export function pathDirectories(value: string | undefined, delimiter: string): string[] {
  return (value ?? "").split(delimiter).filter((entry) => entry !== "" && path.isAbsolute(entry));
}

export function findExecutable(
  executable: string,
  directories: readonly string[],
  exists: ExistsPredicate,
  extensions: readonly string[] = [""],
): string | undefined {
  if (executable === "") {
    return undefined;
  }
  const names = candidateNames(executable, extensions);
  if (path.isAbsolute(executable)) {
    return names.find((name) => exists(name));
  }
  if (executable.includes("/") || executable.includes("\\")) {
    return undefined;
  }
  for (const directory of directories) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (exists(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

function candidateNames(executable: string, extensions: readonly string[]): string[] {
  const names = extensions.map((extension) => executable + extension);
  return !extensions.includes("") && hasExecutableExtension(executable, extensions) ? [executable, ...names] : names;
}

export function detectAgents(
  agents: readonly AgentDefinition[],
  directories: readonly string[],
  exists: ExistsPredicate,
  extensions?: readonly string[],
): Map<string, string> {
  const found = new Map<string, string>();
  for (const agent of agents) {
    const executable = findExecutable(agent.executable, directories, exists, extensions);
    if (executable !== undefined) {
      found.set(agent.id, executable);
    }
  }
  return found;
}
