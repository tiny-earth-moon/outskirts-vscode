import { Finding } from "./findings";

export type ResultsState = "none" | "empty" | "results";

export interface FolderResults {
  readonly findings: readonly Finding[];
  readonly severity: string;
  readonly scannedAt: number;
  readonly stale: ReadonlySet<string>;
}

export function resultsState(entry: FolderResults | undefined): ResultsState {
  if (entry === undefined) {
    return "none";
  }
  return entry.findings.length === 0 ? "empty" : "results";
}

export class ResultsStore {
  private readonly entries = new Map<string, FolderResults>();
  private readonly listeners = new Set<() => void>();

  get(folder: string): FolderResults | undefined {
    return this.entries.get(folder);
  }

  all(): ReadonlyMap<string, FolderResults> {
    return this.entries;
  }

  get total(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      count += entry.findings.length;
    }
    return count;
  }

  set(folder: string, findings: readonly Finding[], severity: string, scannedAt: number): void {
    this.entries.set(folder, { findings, severity, scannedAt, stale: new Set() });
    this.notify();
  }

  markStale(folder: string, file: string): boolean {
    const entry = this.entries.get(folder);
    if (entry === undefined || entry.stale.has(file) || !entry.findings.some((finding) => finding.file === file)) {
      return false;
    }
    this.entries.set(folder, { ...entry, stale: new Set([...entry.stale, file]) });
    this.notify();
    return true;
  }

  clear(folder: string): void {
    if (this.entries.delete(folder)) {
      this.notify();
    }
  }

  clearAll(): void {
    if (this.entries.size > 0) {
      this.entries.clear();
      this.notify();
    }
  }

  retain(folders: readonly string[]): void {
    const kept = new Set(folders);
    const removed = [...this.entries.keys()].filter((folder) => !kept.has(folder));
    for (const folder of removed) {
      this.entries.delete(folder);
    }
    if (removed.length > 0) {
      this.notify();
    }
  }

  onDidChange(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
