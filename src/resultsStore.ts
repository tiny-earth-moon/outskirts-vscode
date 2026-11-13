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
  private known: ReadonlySet<string> | undefined;
  private readonly changedDuringScan = new Map<string, Set<string>>();

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

  set(folder: string, findings: readonly Finding[], severity: string, scannedAt: number): boolean {
    if (this.known !== undefined && !this.known.has(folder)) {
      return false;
    }
    const changed = this.changedDuringScan.get(folder);
    this.changedDuringScan.delete(folder);
    const stale = new Set(findings.map((finding) => finding.file).filter((file) => changed?.has(file) === true));
    this.entries.set(folder, { findings, severity, scannedAt, stale });
    this.notify();
    return true;
  }

  startScan(folder: string): void {
    this.changedDuringScan.set(folder, new Set());
    this.notify();
  }

  endScan(folder: string): void {
    if (this.changedDuringScan.delete(folder)) {
      this.notify();
    }
  }

  get scanned(): readonly string[] {
    return [...this.changedDuringScan.keys()];
  }

  noteChange(file: string): void {
    for (const changed of this.changedDuringScan.values()) {
      changed.add(file);
    }
  }

  setSeverity(folder: string, severity: string): boolean {
    const entry = this.entries.get(folder);
    if (entry === undefined || entry.severity === severity) {
      return false;
    }
    this.entries.set(folder, { ...entry, severity });
    this.notify();
    return true;
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
    this.known = kept;
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
