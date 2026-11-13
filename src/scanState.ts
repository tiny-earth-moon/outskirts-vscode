export class ScanState {
  private active = false;
  private key: string | undefined;

  constructor(private readonly changed: (running: boolean) => void) {}

  get running(): boolean {
    return this.active;
  }

  get scanning(): string | undefined {
    return this.key;
  }

  async sequence<P extends { key: string }>(projects: readonly P[], scanOne: (project: P) => Promise<void>, stopped: () => boolean): Promise<void> {
    this.active = true;
    try {
      for (const project of projects) {
        if (stopped()) {
          break;
        }
        this.key = project.key;
        this.changed(true);
        await scanOne(project);
      }
    } finally {
      this.active = false;
      this.key = undefined;
      this.changed(false);
    }
  }
}
