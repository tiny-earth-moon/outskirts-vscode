export type ScanOnSaveMode = "off" | "project";

export const minimumSaveDelay = 500;
export const defaultSaveDelay = 1500;

export interface Timers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface SaveSchedulerHost {
  mode(project: string): ScanOnSaveMode;
  delay(project: string): number;
  projectOf(file: string): string | undefined;
  eligible(project: string): boolean;
  busy(): boolean;
  start(projects: readonly string[]): void;
}

export function saveMode(value: unknown): ScanOnSaveMode {
  return value === "project" ? "project" : "off";
}

export function saveDelay(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(minimumSaveDelay, value) : defaultSaveDelay;
}

export class SaveScheduler {
  private readonly timers = new Map<string, unknown>();
  private readonly queued: string[] = [];

  constructor(
    private readonly host: SaveSchedulerHost,
    private readonly clock: Timers,
  ) {}

  saved(file: string): void {
    const project = this.host.projectOf(file);
    if (project === undefined || this.host.mode(project) === "off" || !this.host.eligible(project)) {
      return;
    }
    const previous = this.timers.get(project);
    if (previous !== undefined) {
      this.clock.clear(previous);
    }
    this.timers.set(
      project,
      this.clock.set(() => {
        this.timers.delete(project);
        this.fire(project);
      }, saveDelay(this.host.delay(project))),
    );
  }

  idle(): void {
    if (this.queued.length === 0 || this.host.busy()) {
      return;
    }
    const projects = this.queued.splice(0).filter((project) => this.host.mode(project) !== "off" && this.host.eligible(project));
    if (projects.length > 0) {
      this.host.start(projects);
    }
  }

  dispose(): void {
    this.timers.forEach((handle) => {
      this.clock.clear(handle);
    });
    this.timers.clear();
    this.queued.length = 0;
  }

  private fire(project: string): void {
    if (this.host.busy()) {
      if (!this.queued.includes(project)) {
        this.queued.push(project);
      }
      return;
    }
    if (this.host.mode(project) !== "off" && this.host.eligible(project)) {
      this.host.start([project]);
    }
  }
}
