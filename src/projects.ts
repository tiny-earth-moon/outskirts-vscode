import { isScannableRoot, markerGlob } from "./scannable";

const skippedDirectories = new Set(["node_modules", "build", "DerivedData", "Pods", "Carthage", "vendor", "Vendor", "SourcePackages"]);

export interface DirectoryListing {
  key: string;
  name: string;
  entries: readonly string[];
}

export interface FolderListing extends DirectoryListing {
  children: readonly DirectoryListing[];
}

export interface ProjectEntry {
  key: string;
  name: string;
  folderKey: string;
  folderName: string;
  nested: boolean;
}

export const projectWatchPatterns: readonly string[] = [markerGlob, `*/${markerGlob}`, "*"];

export function isCandidateDirectory(name: string, directory: boolean, symlink: boolean): boolean {
  return directory && !symlink && !name.startsWith(".") && !skippedDirectories.has(name);
}

export function discoverProjects(folders: readonly FolderListing[]): ProjectEntry[] {
  const found = uniqueProjects(folders.flatMap((folder) => folderProjects(folder)));
  const counts = new Map<string, number>();
  for (const project of found) {
    counts.set(project.name, (counts.get(project.name) ?? 0) + 1);
  }
  return found.map((project) =>
    (counts.get(project.name) ?? 0) > 1 && project.nested ? { ...project, name: `${project.name} (${project.folderName})` } : project,
  );
}

export function projectForUri(keys: readonly string[], uri: string): string | undefined {
  const matches = keys.filter((key) => uri === key || uri.startsWith(key.endsWith("/") ? key : `${key}/`));
  return matches.sort((a, b) => b.length - a.length).at(0);
}

function folderProjects(folder: FolderListing): ProjectEntry[] {
  const base = { folderKey: folder.key, folderName: folder.name };
  if (isScannableRoot(folder.entries)) {
    return [{ key: folder.key, name: folder.name, ...base, nested: false }];
  }
  return folder.children
    .filter((child) => isScannableRoot(child.entries))
    .map((child) => ({ key: child.key, name: child.name, ...base, nested: true }));
}

function uniqueProjects(found: readonly ProjectEntry[]): ProjectEntry[] {
  const byKey = new Map<string, ProjectEntry>();
  for (const project of found) {
    const kept = byKey.get(project.key);
    if (kept === undefined || (kept.nested && !project.nested)) {
      byKey.set(project.key, project);
    }
  }
  return found.filter((project) => byKey.get(project.key) === project);
}
