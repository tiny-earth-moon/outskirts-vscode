import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { ConfigContents, configFileName, configFileNames, readConfig, schemaComment, updateConfig } from "./configDocument";
import { editorHtml, makeNonce } from "./configEditorHtml";
import { EditorState, HostMessage, StateReason, ViewMessage, WireValue } from "./configMessages";
import { ProjectSummary, recommend } from "./configRecommendations";
import { checkConfig, LoadedSchema, loadSchema } from "./configRunner";
import { OptionValue } from "./configSchema";
import { executableName } from "./optionsTree";
import { pickOneProject } from "./pickFolder";
import { ProjectList } from "./projectList";
import { summarizeProject } from "./projectSummary";

const dismissedKey = "outskirts.dismissedRecommendations";
const externalDelay = 250;

interface ConfigTarget {
  key: string;
  name: string;
  uri: vscode.Uri;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveTarget(argument: unknown, projects: ProjectList): Promise<ConfigTarget | undefined> {
  const fromUri = (uri: vscode.Uri): ConfigTarget => {
    const project = projects.find(uri.toString());
    return project ?? { key: uri.toString(), name: path.basename(uri.fsPath), uri };
  };
  if (argument instanceof vscode.Uri) {
    return fromUri(argument);
  }
  if (typeof argument === "string" && argument !== "") {
    return fromUri(vscode.Uri.file(argument));
  }
  if (typeof argument === "object" && argument !== null && "key" in argument && typeof argument.key === "string") {
    return projects.find(argument.key);
  }
  return pickOneProject(projects.projects, "Project whose configuration to edit");
}

export function registerConfigEditor(extensionUri: vscode.Uri, projects: ProjectList, state: vscode.Memento): vscode.Disposable {
  const panels = new Map<string, ConfigEditorPanel>();
  const command = vscode.commands.registerCommand("outskirts.editConfiguration", async (argument?: unknown) => {
    const target = await resolveTarget(argument, projects);
    if (target === undefined) {
      return undefined;
    }
    const open = panels.get(target.key);
    if (open !== undefined) {
      open.reveal();
      return open;
    }
    const panel = new ConfigEditorPanel(extensionUri, target, state, () => panels.delete(target.key));
    panels.set(target.key, panel);
    return panel;
  });
  return {
    dispose: () => {
      command.dispose();
      for (const panel of [...panels.values()]) {
        panel.dispose();
      }
    },
  };
}

export class ConfigEditorPanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly root: string;
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly last = new Map<HostMessage["type"], HostMessage>();
  private ready = false;
  private disposed = false;
  private loaded: LoadedSchema | undefined;
  private fileName: string = configFileNames[0];
  private fileExists = false;
  private lastText: string | undefined;
  private configured = new Set<string>();
  private summary: Promise<ProjectSummary> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private checkGeneration = 0;
  current: Promise<void>;

  constructor(
    extensionUri: vscode.Uri,
    private readonly target: ConfigTarget,
    private readonly state: vscode.Memento,
    private readonly onDispose: () => void,
  ) {
    this.root = target.uri.fsPath;
    const dist = vscode.Uri.joinPath(extensionUri, "dist");
    this.panel = vscode.window.createWebviewPanel(
      "outskirts.configEditor",
      this.title(false),
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [dist] },
    );
    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, "images", "icon.png");
    const webview = this.panel.webview;
    webview.html = editorHtml({
      cspSource: webview.cspSource,
      nonce: makeNonce(),
      script: webview.asWebviewUri(vscode.Uri.joinPath(dist, "configEditor.js")).toString(),
      style: webview.asWebviewUri(vscode.Uri.joinPath(dist, "configEditor.css")).toString(),
      title: this.title(false),
    });
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(target.uri, `{${configFileNames.join(",")}}`),
    );
    this.subscriptions.push(
      watcher,
      watcher.onDidCreate(() => { this.scheduleExternal(); }),
      watcher.onDidChange(() => { this.scheduleExternal(); }),
      watcher.onDidDelete(() => { this.scheduleExternal(); }),
      webview.onDidReceiveMessage((received: ViewMessage) => this.receive(received)),
      this.panel.onDidDispose(() => { this.dispose(); }),
    );
    this.current = this.load("open");
  }

  get file(): string {
    return path.join(this.root, this.fileName);
  }

  reveal(): void {
    this.panel.reveal();
  }

  messages(): ReadonlyMap<HostMessage["type"], HostMessage> {
    return this.last;
  }

  async receive(received: ViewMessage): Promise<void> {
    switch (received.type) {
      case "ready":
        this.ready = true;
        for (const pending of this.last.values()) {
          void this.panel.webview.postMessage(pending);
        }
        return;
      case "save":
        this.current = this.save(received.changes);
        return this.current;
      case "reload":
        this.current = this.load("reload");
        return this.current;
      case "openYaml":
        if (this.fileExists) {
          await vscode.window.showTextDocument(vscode.Uri.file(this.file), { viewColumn: vscode.ViewColumn.Beside });
        }
        return;
      case "dismiss":
        await this.dismiss(received.id);
        return;
      case "dirty":
        this.panel.title = this.title(received.dirty);
        return;
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    clearTimeout(this.timer);
    this.onDispose();
    this.subscriptions.forEach((subscription) => {
      subscription.dispose();
    });
    this.panel.dispose();
  }

  private title(dirty: boolean): string {
    return `${dirty ? "● " : ""}Configuration: ${this.target.name}`;
  }

  private post(sent: HostMessage): void {
    if (this.disposed) {
      return;
    }
    this.last.set(sent.type, sent);
    if (sent.type === "state" || sent.type === "failed") {
      this.last.delete(sent.type === "state" ? "failed" : "state");
    }
    if (this.ready) {
      void this.panel.webview.postMessage(sent);
    }
  }

  private async readFile(): Promise<string> {
    const entries = await readdir(this.root);
    this.fileName = configFileName(entries);
    this.fileExists = entries.includes(this.fileName);
    return this.fileExists ? readFile(this.file, "utf8") : "";
  }

  private async load(reason: StateReason): Promise<void> {
    try {
      const text = await this.readFile();
      if (this.loaded === undefined || reason === "open" || reason === "reload") {
        this.loaded = await loadSchema(executableName(), this.root);
      }
      const { schema, version } = this.loaded;
      let contents: ConfigContents = { values: {}, complex: {}, other: [] };
      let error: string | undefined;
      try {
        contents = readConfig(text, schema.options);
      } catch (problem) {
        error = message(problem);
      }
      this.lastText = text;
      this.configured = new Set([...Object.keys(contents.values), ...Object.keys(contents.complex)]);
      const state: EditorState = {
        project: this.target.name,
        file: this.fileName,
        fileExists: this.fileExists,
        version,
        options: schema.options.slice(),
        saved: contents.values,
        complex: contents.complex,
        other: contents.other,
        error,
      };
      this.post({ type: "state", state, reason });
      await this.postRecommendations();
      if (this.fileExists && error === undefined) {
        await this.check();
      } else {
        this.last.delete("check");
        this.last.delete("checking");
      }
    } catch (problem) {
      this.post({ type: "failed", message: message(problem) });
    }
  }

  private async postRecommendations(): Promise<void> {
    if (this.loaded === undefined) {
      return;
    }
    const keys = new Set(this.loaded.schema.options.map((option) => option.key));
    if (this.summary === undefined) {
      this.post({ type: "recommendations", recommendations: [], scanning: true });
      this.summary = summarizeProject(this.root);
    }
    const summary = await this.summary;
    const recommendations = recommend({
      summary,
      keys,
      configured: this.configured,
      fileExists: this.fileExists,
      fileName: this.fileName,
      dismissed: new Set(this.dismissed()),
    });
    this.post({ type: "recommendations", recommendations, scanning: false });
  }

  private async check(): Promise<void> {
    const generation = ++this.checkGeneration;
    this.post({ type: "checking" });
    const result = await checkConfig(executableName(), this.root, this.fileName);
    if (generation === this.checkGeneration) {
      this.last.delete("checking");
      this.post({ type: "check", result });
    }
  }

  private async save(changes: Record<string, WireValue>): Promise<void> {
    if (this.loaded === undefined) {
      return;
    }
    try {
      const open = vscode.workspace.textDocuments.find((document) => document.uri.fsPath === this.file);
      if (open?.isDirty === true) {
        throw new Error(`${this.fileName} has unsaved changes in an editor. Save or revert them, then save here again.`);
      }
      const text = await this.readFile();
      const values: Record<string, OptionValue | undefined> = {};
      for (const [key, value] of Object.entries(changes)) {
        values[key] = value ?? undefined;
      }
      const header = this.fileExists ? undefined : schemaComment(this.loaded.schema.id);
      const updated = updateConfig(text, this.loaded.schema.options, values, header);
      if (updated !== text || !this.fileExists) {
        this.lastText = updated;
        await vscode.workspace.fs.writeFile(vscode.Uri.file(this.file), Buffer.from(updated, "utf8"));
      }
    } catch (problem) {
      this.post({ type: "saveFailed", message: message(problem) });
      return;
    }
    await this.load("saved");
  }

  private scheduleExternal(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.external();
    }, externalDelay);
  }

  private async external(): Promise<void> {
    if (this.disposed) {
      return;
    }
    let text: string | undefined;
    try {
      const entries = await readdir(this.root);
      const name = configFileName(entries);
      text = entries.includes(name) ? await readFile(path.join(this.root, name), "utf8") : undefined;
    } catch {
      text = undefined;
    }
    if (text === this.lastText || (text === undefined && !this.fileExists)) {
      return;
    }
    this.current = this.load("external");
    await this.current;
  }

  private dismissed(): string[] {
    return this.state.get<Record<string, string[]>>(dismissedKey, {})[this.target.key] ?? [];
  }

  private async dismiss(id: string): Promise<void> {
    const all = { ...this.state.get<Record<string, string[]>>(dismissedKey, {}) };
    all[this.target.key] = [...new Set([...this.dismissed(), id])];
    await this.state.update(dismissedKey, all);
    await this.postRecommendations();
  }
}
