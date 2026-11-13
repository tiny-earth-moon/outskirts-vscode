export class CurrentFolder {
  private keys: readonly string[] = [];
  private selected: string | undefined;

  get current(): string | undefined {
    return this.selected !== undefined && this.keys.includes(this.selected) ? this.selected : this.keys.at(0);
  }

  get several(): boolean {
    return this.keys.length > 1;
  }

  setFolders(keys: readonly string[]): void {
    this.keys = keys;
  }

  select(key: string): boolean {
    if (!this.keys.includes(key) || key === this.current) {
      return false;
    }
    this.selected = key;
    return true;
  }
}
