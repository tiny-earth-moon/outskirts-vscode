import * as vscode from "vscode";
import { severityFromSetting } from "./diagnostics";
import { toFindings } from "./findings";
import { interpretRun, ScanFailedError } from "./outcome";
import { ResultsStore } from "./resultsStore";
import { CancelledError, ExecutableNotFoundError, runProcess } from "./runProcess";
import { buildScanArguments } from "./scanArguments";
import { resolveExecutable } from "./executable";
import { folderKey } from "./scannableFolders";
import { scanSummary, sequenceSummary } from "./summary";

const installHint = "Install it with `brew install tiny-earth-moon/tap/outskirts` or set `outskirts.path`.";

export class Scanner {
  private controller: AbortController | undefined;
  private cancelled = false;
  private readonly runningChanged = new vscode.EventEmitter<boolean>();
  readonly onDidChangeRunning = this.runningChanged.event;
  private scanningKey: string | undefined;

  constructor(
    private readonly store: ResultsStore,
    private readonly output: vscode.OutputChannel,
    private readonly namesFolders: () => boolean,
  ) {}

  get running(): boolean {
    return this.controller !== undefined;
  }

  get scanning(): string | undefined {
    return this.scanningKey;
  }

  cancel(): void {
    this.cancelled = true;
    this.controller?.abort();
  }

  async scan(folders: readonly vscode.WorkspaceFolder[]): Promise<void> {
    if (this.running) {
      void vscode.window.showWarningMessage("outskirts: a scan is already running.");
      return;
    }
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showErrorMessage("outskirts: a scan builds the project, so it only runs in a trusted workspace.");
      return;
    }
    this.cancelled = false;
    const counts: number[] = [];
    for (const folder of folders) {
      if (this.cancelled) {
        break;
      }
      const controller = new AbortController();
      this.setController(controller, folderKey(folder));
      try {
        counts.push(await this.run(folder, controller));
        if (folders.length === 1) {
          void announce(scanSummary(counts[0], this.namesFolders() ? folder.name : undefined), counts[0]);
        }
      } catch (error) {
        if (error instanceof CancelledError) {
          this.cancelled = true;
        }
        void report(error, this.output);
      } finally {
        this.setController(undefined, undefined);
      }
    }
    if (folders.length > 1 && counts.length > 0) {
      const total = counts.reduce((sum, count) => sum + count, 0);
      void announce(sequenceSummary(counts), total);
    }
  }

  dispose(): void {
    this.cancel();
    this.runningChanged.dispose();
  }

  private async run(folder: vscode.WorkspaceFolder, controller: AbortController): Promise<number> {
    const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
    const executable = resolveExecutable(config.inspect<string>("path"));
    const args = buildScanArguments(config.get<string[]>("arguments", []), config.get<boolean>("skipBuild", false));
    const cwd = folder.uri.fsPath;
    const severity = config.get<string>("severity", "warning");
    severityFromSetting(severity);
    const title = this.namesFolders() ? `outskirts: scanning ${folder.name}` : "outskirts: scanning";
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
    this.output.appendLine(`outskirts exited with status ${String(run.exitCode)}.`);
    const findings = toFindings(interpretRun(run), cwd);
    this.store.set(folderKey(folder), findings, severity, Date.now());
    return findings.length;
  }

  private setController(controller: AbortController | undefined, key: string | undefined): void {
    this.controller = controller;
    this.scanningKey = key;
    this.runningChanged.fire(controller !== undefined);
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
  const detail = error instanceof ScanFailedError ? message : `outskirts: ${message}`;
  const choice = await vscode.window.showErrorMessage(detail, openOutput);
  if (choice === openOutput) {
    output.show();
  }
}
