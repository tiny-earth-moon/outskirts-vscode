import { readdir, readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import { ProjectSummary, Signal, sourceSignals } from "./configRecommendations";

export interface SummaryEntry {
  name: string;
  directory: boolean;
  file: boolean;
}

export interface SummaryFileSystem {
  list: (directory: string) => Promise<readonly SummaryEntry[]>;
  size: (file: string) => Promise<number>;
  read: (file: string) => Promise<string>;
}

export interface SummaryLimits {
  files: number;
  readFiles: number;
  readBytes: number;
  depth: number;
}

export const defaultLimits: SummaryLimits = { files: 5000, readFiles: 1500, readBytes: 256 * 1024, depth: 10 };

const skippedDirectories = new Set([
  "build",
  "DerivedData",
  "Pods",
  "Carthage",
  "node_modules",
  "SourcePackages",
  "xcuserdata",
  "vendor",
  "Vendor",
]);

export function isSkippedDirectory(name: string): boolean {
  return name.startsWith(".") || skippedDirectories.has(name);
}

export async function summarizeProject(
  root: string,
  fileSystem: SummaryFileSystem = nodeFileSystem,
  limits: SummaryLimits = defaultLimits,
): Promise<ProjectSummary> {
  const files: string[] = [];
  const signals: Partial<Record<Signal, number>> = {};
  let truncated = false;
  let read = 0;
  let queue: { relative: string; depth: number }[] = [{ relative: "", depth: 0 }];
  while (queue.length > 0 && !truncated) {
    const next: typeof queue = [];
    for (const { relative, depth } of queue) {
      const entries = await listSafely(fileSystem, path.join(root, relative));
      for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
        const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
        if (entry.directory) {
          if (!isSkippedDirectory(entry.name) && depth + 1 < limits.depth) {
            next.push({ relative: child, depth: depth + 1 });
          }
          continue;
        }
        if (!entry.file) {
          continue;
        }
        if (files.length >= limits.files) {
          truncated = true;
          break;
        }
        files.push(child);
        if (child.endsWith(".swift") && child !== "Package.swift" && read < limits.readFiles) {
          read += 1;
          const text = await readSafely(fileSystem, path.join(root, child), limits.readBytes);
          for (const signal of text === undefined ? [] : sourceSignals(text)) {
            signals[signal] = (signals[signal] ?? 0) + 1;
          }
        }
      }
      if (truncated) {
        break;
      }
    }
    queue = next;
  }
  const manifest = files.includes("Package.swift")
    ? await readSafely(fileSystem, path.join(root, "Package.swift"), limits.readBytes)
    : undefined;
  return { files, truncated, signals, manifest };
}

async function listSafely(fileSystem: SummaryFileSystem, directory: string): Promise<readonly SummaryEntry[]> {
  try {
    return await fileSystem.list(directory);
  } catch {
    return [];
  }
}

async function readSafely(fileSystem: SummaryFileSystem, file: string, limit: number): Promise<string | undefined> {
  try {
    return (await fileSystem.size(file)) > limit ? undefined : await fileSystem.read(file);
  } catch {
    return undefined;
  }
}

const nodeFileSystem: SummaryFileSystem = {
  list: async (directory) =>
    (await readdir(directory, { withFileTypes: true })).map((entry) => ({
      name: entry.name,
      directory: entry.isDirectory(),
      file: entry.isFile(),
    })),
  size: async (file) => (await stat(file)).size,
  read: (file) => readFile(file, "utf8"),
};
