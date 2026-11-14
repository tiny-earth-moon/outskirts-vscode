import * as vscode from "vscode";
import { severityFromSetting } from "./diagnostics";
import { toFindings } from "./findings";
import { exitDescription, interpretRun } from "./outcome";
import { ResultsStore } from "./resultsStore";
import { CancelledError, runProcess } from "./runProcess";
import { buildScanArguments } from "./scanArguments";
import { resolveExecutable } from "./executable";
import { Project } from "./project";
import { scanSummary, sequenceSummary } from "./summary";
import { failureToast, ScanError, scanError } from "./scanError";
import { projectArguments, readProjectFolder } from "./xcodeProject";
import { ScanState } from "./scanState";
import { probeVersion } from "./versionProbe";
import { folderAliases } from "./realFolders";
import { printsAbsolutePathsWhenAsked, printsResultsWhenAsked } from "./version";
import { relativeResultsBase } from "./location";
import { checkRelativeLocations } from "./relativeResults";
import { toEditorColumns } from "./editorColumns";
import { configuredBaseline, usesBaseline } from "./baseline";
import { readConfigFile } from "./baselineConfig";
import { FixTarget } from "./results";
import { readScanConfig, redirectSources } from "./resultsRedirect";

export interface ScanOverrides {
  arguments?: readonly string[];
  skipBuild?: boolean;
  onSave?: boolean;
}

export class Scanner {
  private controller: AbortController | undefined;
  private cancelled = false;
  private removed: string | undefined;
  private onSave = false;
  private readonly errors = new Map<string, ScanError>();
  private readonly baselines = new Set<string>();
  private readonly runningChanged = new vscode.EventEmitter<boolean>();
  readonly onDidChangeRunning = this.runningChanged.event;
  private readonly state = new ScanState((running) => {
    this.runningChanged.fire(running);
  });

  constructor(
    private readonly store: ResultsStore,
    private readonly output: vscode.OutputChannel,
    private readonly viewsVisible: () => boolean = () => false,
  ) {}

  get running(): boolean {
    return this.state.running;
  }

  get scanning(): string | undefined {
    return this.state.scanning;
  }

  get scanningOnSave(): boolean {
    return this.running && this.onSave;
  }

  get failed(): ReadonlyMap<string, ScanError> {
    return this.errors;
  }

  get baselined(): ReadonlySet<string> {
    return this.baselines;
  }

  forget(key: string): void {
    this.errors.delete(key);
  }

  forgetAll(): void {
    this.errors.clear();
  }

  cancel(): void {
    this.cancelled = true;
    this.controller?.abort();
  }

  cancelRemoved(exists: (key: string) => boolean): void {
    const key = this.state.scanning;
    if (key !== undefined && !exists(key)) {
      this.removed = key;
      this.controller?.abort();
    }
  }

  async scan(projects: readonly Project[]): Promise<void> {
    await this.scanWith(projects, {});
  }

  async scanWith(projects: readonly Project[], overrides: ScanOverrides): Promise<boolean> {
    if (this.running) {
      void vscode.window.showWarningMessage("A scan is already running.");
      return false;
    }
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showErrorMessage("A scan builds the project, so it only runs in a trusted workspace.");
      return false;
    }
    this.cancelled = false;
    const onSave = overrides.onSave === true;
    this.onSave = onSave;
    const counts: number[] = [];
    await this.state.sequence(
      projects,
      async (project) => {
        const controller = new AbortController();
        this.controller = controller;
        this.errors.delete(project.key);
        this.store.startScan(project.key);
        try {
          counts.push(await this.run(project, controller, overrides));
          if (projects.length === 1 && !onSave) {
            void announce(scanSummary(counts[0], project.name), counts[0]);
          }
        } catch (error) {
          if (error instanceof CancelledError && this.removed !== project.key) {
            this.cancelled = true;
          }
          this.output.appendLine(error instanceof Error ? error.message : String(error));
          if (!(error instanceof CancelledError)) {
            this.errors.set(project.key, scanError(error));
            if (!this.viewsVisible()) {
              void showFailure(project.name);
            }
          }
        } finally {
          this.store.endScan(project.key);
          this.controller = undefined;
          this.removed = undefined;
        }
      },
      () => this.cancelled,
    );
    this.onSave = false;
    if (projects.length > 1 && counts.length > 0 && !onSave) {
      const total = counts.reduce((sum, count) => sum + count, 0);
      void announce(sequenceSummary(counts), total);
    }
    return counts.length === projects.length;
  }

  dispose(): void {
    this.cancel();
    this.runningChanged.dispose();
  }

  private async run(project: Project, controller: AbortController, overrides: ScanOverrides): Promise<number> {
    const config = vscode.workspace.getConfiguration("outskirts", project.workspaceFolder.uri);
    const executable = resolveExecutable(config.inspect<string>("path"));
    const cwd = project.uri.fsPath;
    const extra = config.get<string[]>("arguments", []);
    const version = await probeVersion(executable, cwd);
    const skipBuild = overrides.skipBuild === true || config.get<boolean>("skipBuild", false);
    const onSave = overrides.onSave === true;
    const args = buildScanArguments([...extra, ...(overrides.arguments ?? [])], {
      skipBuild,
      project: projectArguments(await readProjectFolder(cwd), extra),
      printResults: version.state === "found" && printsResultsWhenAsked(version.version),
      absolutePaths: version.state === "found" && printsAbsolutePathsWhenAsked(version.version),
    });
    const severity = config.get<string>("severity", "warning");
    severityFromSetting(severity);
    const title = `Scanning ${project.name}`;
    const run = await vscode.window.withProgress(
      { location: onSave ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification, title, cancellable: !onSave },
      (_progress, token) => {
        token.onCancellationRequested(() => {
          this.cancel();
        });
        this.output.appendLine(`$ ${executable} ${args.join(" ")}  (in ${cwd})`);
        return runProcess(executable, args, { cwd, signal: controller.signal, onOutput: (text) => {
          this.output.append(text);
        } });
      },
    );
    this.output.appendLine(exitDescription(run));
    const results = interpretRun(run, await this.redirects(run.stdout, cwd, [...extra, ...(overrides.arguments ?? [])]));
    const base = relativeResultsBase(cwd, extra);
    await checkRelativeLocations(results, base);
    const aliases = await folderAliases([cwd, project.workspaceFolder.uri.fsPath]);
    const findings = await toEditorColumns(toFindings(results, base, aliases), (message) => {
      this.output.appendLine(message);
    });
    await this.noteBaseline(project.key, cwd, extra);
    this.store.set(project.key, findings, severity, Date.now(), onSave && skipBuild);
    return findings.length;
  }

  private async redirects(stdout: string, cwd: string, extra: readonly string[]): Promise<FixTarget[]> {
    if (stdout.trim() !== "") {
      return [];
    }
    try {
      return redirectSources(extra, await readScanConfig(cwd, extra));
    } catch (error) {
      this.output.appendLine(`Could not read the configuration file: ${error instanceof Error ? error.message : String(error)}`);
      return ["configuration"];
    }
  }

  private async noteBaseline(key: string, cwd: string, extra: readonly string[]): Promise<void> {
    let configured: string | undefined;
    try {
      const file = await readConfigFile(cwd);
      configured = file.text === undefined ? undefined : configuredBaseline(file.text);
    } catch (error) {
      this.output.appendLine(`Could not read the baseline of the configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (usesBaseline(configured, extra)) {
      this.baselines.add(key);
    } else {
      this.baselines.delete(key);
    }
  }
}

async function announce(message: string, count: number): Promise<void> {
  if (count === 0) {
    void vscode.window.showInformationMessage(message);
    return;
  }
  const showProblems = "Show Problems";
  const choice = await vscode.window.showInformationMessage(message, showProblems);
  if (choice === showProblems) {
    await vscode.commands.executeCommand("workbench.actions.view.problems");
  }
}

async function showFailure(project: string): Promise<void> {
  const show = "Show";
  const choice = await vscode.window.showErrorMessage(failureToast(project), show);
  if (choice === show) {
    await vscode.commands.executeCommand("outskirts.results.focus");
  }
}
