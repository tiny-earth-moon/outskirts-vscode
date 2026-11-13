import * as vscode from "vscode";
import { severityFromSetting } from "./diagnostics";
import { toFindings } from "./findings";
import { exitDescription, interpretRun } from "./outcome";
import { ResultsStore } from "./resultsStore";
import { CancelledError, ExecutableNotFoundError, runProcess } from "./runProcess";
import { buildScanArguments } from "./scanArguments";
import { resolveExecutable } from "./executable";
import { Project } from "./project";
import { scanSummary, sequenceSummary } from "./summary";
import { installHint } from "./optionsModel";
import { projectArguments, readProjectFolder } from "./xcodeProject";
import { ScanState } from "./scanState";
import { probeVersion } from "./versionProbe";
import { folderAliases } from "./realFolders";
import { printsResultsWhenAsked } from "./version";

export class Scanner {
  private controller: AbortController | undefined;
  private cancelled = false;
  private removed: string | undefined;
  private readonly runningChanged = new vscode.EventEmitter<boolean>();
  readonly onDidChangeRunning = this.runningChanged.event;
  private readonly state = new ScanState((running) => {
    this.runningChanged.fire(running);
  });

  constructor(
    private readonly store: ResultsStore,
    private readonly output: vscode.OutputChannel,
  ) {}

  get running(): boolean {
    return this.state.running;
  }

  get scanning(): string | undefined {
    return this.state.scanning;
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
    if (this.running) {
      void vscode.window.showWarningMessage("A scan is already running.");
      return;
    }
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showErrorMessage("A scan builds the project, so it only runs in a trusted workspace.");
      return;
    }
    this.cancelled = false;
    const counts: number[] = [];
    await this.state.sequence(
      projects,
      async (project) => {
        const controller = new AbortController();
        this.controller = controller;
        try {
          counts.push(await this.run(project, controller));
          if (projects.length === 1) {
            void announce(scanSummary(counts[0], project.name), counts[0]);
          }
        } catch (error) {
          if (error instanceof CancelledError && this.removed !== project.key) {
            this.cancelled = true;
          }
          void report(error, this.output);
        } finally {
          this.controller = undefined;
          this.removed = undefined;
        }
      },
      () => this.cancelled,
    );
    if (projects.length > 1 && counts.length > 0) {
      const total = counts.reduce((sum, count) => sum + count, 0);
      void announce(sequenceSummary(counts), total);
    }
  }

  dispose(): void {
    this.cancel();
    this.runningChanged.dispose();
  }

  private async run(project: Project, controller: AbortController): Promise<number> {
    const config = vscode.workspace.getConfiguration("outskirts", project.workspaceFolder.uri);
    const executable = resolveExecutable(config.inspect<string>("path"));
    const cwd = project.uri.fsPath;
    const extra = config.get<string[]>("arguments", []);
    const version = await probeVersion(executable, cwd);
    const args = buildScanArguments(extra, {
      skipBuild: config.get<boolean>("skipBuild", false),
      project: projectArguments(await readProjectFolder(cwd), extra),
      printResults: version.state === "found" && printsResultsWhenAsked(version.version),
    });
    const severity = config.get<string>("severity", "warning");
    severityFromSetting(severity);
    const title = `Scanning ${project.name}`;
    const run = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title, cancellable: true },
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
    const aliases = await folderAliases([cwd, project.workspaceFolder.uri.fsPath]);
    const findings = toFindings(interpretRun(run), cwd, aliases);
    this.store.set(project.key, findings, severity, Date.now());
    return findings.length;
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

async function report(error: unknown, output: vscode.OutputChannel): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  output.appendLine(message);
  if (error instanceof CancelledError) {
    return;
  }
  if (error instanceof ExecutableNotFoundError) {
    void vscode.window.showErrorMessage(`${message} ${installHint}`);
    return;
  }
  const openOutput = "Open Output";
  const choice = await vscode.window.showErrorMessage(message, openOutput);
  if (choice === openOutput) {
    output.show();
  }
}
