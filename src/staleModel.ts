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

export function filesWithResults(results: ReadonlyMap<string, FolderResults>): string[] {
  const files = new Set<string>();
  for (const entry of results.values()) {
    for (const finding of entry.findings) {
      if (!entry.stale.has(finding.file)) {
        files.add(finding.file);
      }
    }
  }
  return [...files].sort();
}

export function projectsWithFile(results: ReadonlyMap<string, FolderResults>, file: string): string[] {
  return [...results].filter(([, entry]) => entry.findings.some((finding) => finding.file === file)).map(([key]) => key);
}
