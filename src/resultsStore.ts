import { Finding } from "./findings";

export type ResultsState = "none" | "empty" | "results";

export class ResultsStore {
  private current: readonly Finding[] = [];
  private scanned = false;
  private level = "warning";
  private readonly listeners = new Set<() => void>();

  get findings(): readonly Finding[] {
    return this.current;
  }

  get severity(): string {
    return this.level;
  }

  get state(): ResultsState {
    if (!this.scanned) {
      return "none";
    }
    return this.current.length === 0 ? "empty" : "results";
  }

  set(findings: readonly Finding[], severity: string): void {
    this.current = findings;
    this.level = severity;
    this.scanned = true;
    this.notify();
  }

  clear(): void {
    this.current = [];
    this.scanned = false;
    this.notify();
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
