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
  private readonly running = new Map<string, { readonly startedAt: number; readonly changed: Set<string> }>();
  private readonly shownScanStart = new Map<string, number>();

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

  set(folder: string, findings: readonly Finding[], severity: string, scannedAt: number, keepStale = false): boolean {
    if (this.known !== undefined && !this.known.has(folder)) {
      return false;
    }
    const scan = this.running.get(folder);
    this.running.delete(folder);
    if (scan === undefined) {
      this.shownScanStart.delete(folder);
    } else {
      this.shownScanStart.set(folder, scan.startedAt);
    }
    const previous = keepStale ? this.entries.get(folder)?.stale : undefined;
    const stale = new Set(findings.map((finding) => finding.file).filter((file) => scan?.changed.has(file) === true || previous?.has(file) === true));
    this.entries.set(folder, { findings, severity, scannedAt, stale });
    this.notify();
    return true;
  }

  startScan(folder: string, startedAt = Date.now()): void {
    this.running.set(folder, { startedAt, changed: new Set() });
    this.notify();
  }

  endScan(folder: string): void {
    if (this.running.delete(folder)) {
      this.notify();
    }
  }

  get scanned(): readonly string[] {
    return [...this.running.keys()];
  }

  noteChange(file: string, writtenAt?: number): void {
    for (const scan of this.running.values()) {
      if (!writtenBefore(writtenAt, scan.startedAt)) {
        scan.changed.add(file);
      }
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

  markStale(folder: string, file: string, writtenAt?: number): boolean {
    const entry = this.entries.get(folder);
    if (entry === undefined || entry.stale.has(file) || writtenBefore(writtenAt, this.shownScanStart.get(folder)) || !entry.findings.some((finding) => finding.file === file)) {
      return false;
    }
    this.entries.set(folder, { ...entry, stale: new Set([...entry.stale, file]) });
    this.notify();
    return true;
  }

  clear(folder: string): void {
    this.shownScanStart.delete(folder);
    if (this.entries.delete(folder)) {
      this.notify();
    }
  }

  clearAll(): void {
    this.shownScanStart.clear();
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
      this.shownScanStart.delete(folder);
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

function writtenBefore(writtenAt: number | undefined, scanStart: number | undefined): boolean {
  return writtenAt !== undefined && scanStart !== undefined && writtenAt < scanStart;
}
