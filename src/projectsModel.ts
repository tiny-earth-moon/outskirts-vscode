import { FolderResults } from "./resultsStore";
import { statusText } from "./summary";
import { withBaseline } from "./baseline";

export type ProjectKind = "package" | "xcode" | "generic";
export type ProjectState = "scanning" | "results" | "empty" | "stale" | "notScanned" | "error";

export interface ProjectSource {
  key: string;
  name: string;
  relativePath: string;
  kind: ProjectKind;
}

export interface ProjectRow extends ProjectSource {
  state: ProjectState;
  description: string;
  contextValue: string;
}

export interface ProjectsContext {
  results: ReadonlyMap<string, FolderResults>;
  scanning: string | undefined;
  failed: ReadonlySet<string>;
  baselined?: ReadonlySet<string>;
}

export function projectKind(entries: readonly string[]): ProjectKind {
  if (entries.some((name) => name.endsWith(".xcworkspace") || name.endsWith(".xcodeproj"))) {
    return "xcode";
  }
  return entries.includes("Package.swift") ? "package" : "generic";
}

export function projectState(key: string, context: ProjectsContext): ProjectState {
  if (context.scanning === key) {
    return "scanning";
  }
  if (context.failed.has(key)) {
    return "error";
  }
  const entry = context.results.get(key);
  if (entry === undefined) {
    return "notScanned";
  }
  if (entry.stale.size > 0) {
    return "stale";
  }
  return entry.findings.length === 0 ? "empty" : "results";
}

export function stateText(state: ProjectState, entry: FolderResults | undefined): string {
  switch (state) {
    case "scanning":
      return "scanning…";
    case "error":
      return "error";
    case "notScanned":
      return "not scanned";
    case "empty":
      return "no unused code";
    case "stale":
      return `${statusText(entry?.findings.length ?? 0)}, stale`;
    case "results":
      return statusText(entry?.findings.length ?? 0);
  }
}

export function projectRows(projects: readonly ProjectSource[], context: ProjectsContext): ProjectRow[] {
  return [...projects]
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.name.localeCompare(b.name))
    .map((project) => {
      const state = projectState(project.key, context);
      const scanned = state === "results" || state === "empty" || state === "stale";
      const text = withBaseline(stateText(state, context.results.get(project.key)), scanned && context.baselined?.has(project.key) === true);
      const description = project.relativePath === "" ? text : `${project.relativePath} · ${text}`;
      const cleared = state === "notScanned" || state === "scanning" ? "" : ".results";
      return { ...project, state, description, contextValue: `project.${state === "scanning" ? "scanning" : "idle"}${cleared}` };
    });
}
