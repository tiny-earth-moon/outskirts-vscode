import * as vscode from "vscode";
import { FolderInfo } from "./folderModel";
import { Project, projectInfo } from "./project";
import { findProjects } from "./projectDiscovery";
import { projectForUri } from "./projects";

const markers = "{Package.swift,project.yml,.outskirts.yml,.periphery.yml}";
const debounce = 300;

export class ProjectList {
  private current: readonly Project[] = [];
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  private watchers: vscode.Disposable[] = [];
  private timer: NodeJS.Timeout | undefined;
  private generation = 0;
  private readonly subscription = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    this.watch();
    void this.refresh();
  });

  constructor() {
    this.watch();
  }

  get projects(): readonly Project[] {
    return this.current;
  }

  get infos(): FolderInfo[] {
    return this.current.map(projectInfo);
  }

  find(key: string): Project | undefined {
    return this.current.find((project) => project.key === key);
  }

  containing(uri: vscode.Uri): Project | undefined {
    const key = projectForUri(this.current.map((project) => project.key), uri.toString());
    return key === undefined ? undefined : this.find(key);
  }

  async refresh(): Promise<void> {
    const generation = ++this.generation;
    const projects = await findProjects(vscode.workspace.workspaceFolders ?? []);
    if (generation !== this.generation) {
      return;
    }
    this.current = projects;
    this.changed.fire();
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposeWatchers();
    this.subscription.dispose();
    this.changed.dispose();
  }

  private watch(): void {
    this.disposeWatchers();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      for (const pattern of [markers, `*/${markers}`]) {
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, pattern), false, true, false);
        this.watchers.push(watcher, watcher.onDidCreate(() => { this.schedule(); }), watcher.onDidDelete(() => { this.schedule(); }));
      }
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.refresh();
    }, debounce);
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }
}
