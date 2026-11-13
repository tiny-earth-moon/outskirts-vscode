import * as path from "node:path";
import { AgentDefinition } from "./agents";

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
  if (path.isAbsolute(executable)) {
    return exists(executable) ? executable : undefined;
  }
  if (executable.includes("/") || executable.includes("\\")) {
    return undefined;
  }
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, executable + extension);
      if (exists(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
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
