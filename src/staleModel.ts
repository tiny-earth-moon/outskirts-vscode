import * as path from "node:path";
import { Finding } from "./findings";
import { FolderResults } from "./resultsStore";

export const staleScopeMessage = "Scan again: the results of this file are out of date.";
export const staleHint = "Scan again to refresh the results of the changed files.";

export function isStaleFinding(results: ReadonlyMap<string, FolderResults>, finding: Finding): boolean {
  for (const entry of results.values()) {
    if (entry.findings.includes(finding)) {
      return entry.stale.has(finding.file);
    }
  }
  return false;
}

export function freshFindings(entry: FolderResults | undefined, findings: readonly Finding[]): Finding[] {
  return findings.filter((finding) => entry?.stale.has(finding.file) !== true);
}

export interface WatchRoot {
  readonly base: string;
  readonly pattern: "**/*" | "*";
}

export function watchRoots(
  results: ReadonlyMap<string, FolderResults>,
  rootOf: (project: string) => string | undefined,
  scanned: readonly string[] = [],
): WatchRoot[] {
  const recursive = new Set(scanned.map(rootOf).filter((root) => root !== undefined));
  const flat = new Set<string>();
  for (const [project, entry] of results) {
    const root = rootOf(project);
    if (root !== undefined && entry.findings.length > 0) {
      recursive.add(root);
    }
    for (const finding of entry.findings) {
      if (root === undefined || !isInside(finding.file, root)) {
        flat.add(path.dirname(finding.file));
      }
    }
  }
  const roots = [...recursive].filter((root) => ![...recursive].some((other) => other !== root && isInside(root, other)));
  const folders = [...flat].filter((folder) => !roots.some((root) => folder === root || isInside(folder, root)));
  return [
    ...roots.sort().map((base) => ({ base, pattern: "**/*" as const })),
    ...folders.sort().map((base) => ({ base, pattern: "*" as const })),
  ];
}

export function projectsByFile(results: ReadonlyMap<string, FolderResults>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [project, entry] of results) {
    for (const finding of entry.findings) {
      const projects = index.get(finding.file) ?? [];
      if (!projects.includes(project)) {
        projects.push(project);
        index.set(finding.file, projects);
      }
    }
  }
  return index;
}

function isInside(file: string, folder: string): boolean {
  return file.startsWith(folder.endsWith(path.sep) ? folder : folder + path.sep);
}
