import * as vscode from "vscode";
import { severityFromSetting } from "./diagnostics";
import { toFindings } from "./findings";
import { interpretRun, ScanFailedError } from "./outcome";
import { pickFolder } from "./pickFolder";
import { ResultsStore } from "./resultsStore";
import { CancelledError, ExecutableNotFoundError, runProcess } from "./runProcess";
import { buildScanArguments } from "./scanArguments";
import { resolveExecutable } from "./executable";
import { scanSummary } from "./summary";

const installHint = "Install it with `brew install tiny-earth-moon/tap/outskirts` or set `outskirts.path`.";

export class Scanner {
  private controller: AbortController | undefined;
  private readonly runningChanged = new vscode.EventEmitter<boolean>();
  readonly onDidChangeRunning = this.runningChanged.event;
  folder: vscode.WorkspaceFolder | undefined;

  constructor(private readonly store: ResultsStore, private readonly output: vscode.OutputChannel) {}

  get running(): boolean {
    return this.controller !== undefined;
  }

  cancel(): void {
    this.controller?.abort();
  }

  async scan(): Promise<void> {
    if (this.running) {
      void vscode.window.showWarningMessage("outskirts: a scan is already running.");
      return;
    }
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showErrorMessage("outskirts: a scan builds the project, so it only runs in a trusted workspace.");
      return;
    }
    const controller = new AbortController();
    this.setController(controller);
    try {
      await this.run(controller);
    } catch (error) {
      await report(error, this.output);
    } finally {
      this.setController(undefined);
    }
  }

  dispose(): void {
    this.cancel();
    this.runningChanged.dispose();
  }

  private async run(controller: AbortController): Promise<void> {
    const folder = await pickFolder();
    if (folder === undefined) {
      return;
    }
    const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
    const executable = resolveExecutable(config.inspect<string>("path"));
    const args = buildScanArguments(config.get<string[]>("arguments", []), config.get<boolean>("skipBuild", false));
    const cwd = folder.uri.fsPath;
    const severity = config.get<string>("severity", "warning");
    severityFromSetting(severity);
    const run = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "outskirts: scanning", cancellable: true },
      (_progress, token) => {
        token.onCancellationRequested(() => {
          controller.abort();
        });
        this.output.appendLine(`$ ${executable} ${args.join(" ")}  (in ${cwd})`);
        return runProcess(executable, args, { cwd, signal: controller.signal, onOutput: (text) => {
          this.output.append(text);
        } });
      },
    );
    this.output.appendLine(`outskirts exited with status ${String(run.exitCode)}.`);
    const findings = toFindings(interpretRun(run), cwd);
    this.folder = folder;
    this.store.set(findings, severity);
    void announce(findings.length);
  }

  private setController(controller: AbortController | undefined): void {
    this.controller = controller;
    this.runningChanged.fire(controller !== undefined);
  }
}

async function announce(count: number): Promise<void> {
  if (count === 0) {
    void vscode.window.showInformationMessage(scanSummary(count));
    return;
  }
  const showProblems = "Show Problems";
  const choice = await vscode.window.showInformationMessage(scanSummary(count), showProblems);
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
