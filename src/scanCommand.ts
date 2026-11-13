import * as vscode from "vscode";
import { severityFromSetting, showFindings } from "./diagnostics";
import { toFindings } from "./findings";
import { interpretRun, ScanFailedError } from "./outcome";
import { pickFolder } from "./pickFolder";
import { CancelledError, ExecutableNotFoundError, runProcess } from "./runProcess";
import { buildScanArguments } from "./scanArguments";
import { resolveExecutable } from "./executable";
import { scanSummary } from "./summary";

const installHint = "Install it with `brew install tiny-earth-moon/tap/outskirts` or set `outskirts.path`.";

export async function scan(collection: vscode.DiagnosticCollection, output: vscode.OutputChannel): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showErrorMessage("outskirts: a scan builds the project, so it only runs in a trusted workspace.");
    return;
  }
  const folder = await pickFolder();
  if (folder === undefined) {
    return;
  }
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  const executable = resolveExecutable(config.inspect<string>("path"));
  const args = buildScanArguments(config.get<string[]>("arguments", []));
  const cwd = folder.uri.fsPath;
  try {
    const severity = severityFromSetting(config.get<string>("severity", "warning"));
    const run = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "outskirts: scanning", cancellable: true },
      (_progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => {
          controller.abort();
        });
        output.appendLine(`$ ${executable} ${args.join(" ")}  (in ${cwd})`);
        return runProcess(executable, args, { cwd, signal: controller.signal, onOutput: (text) => {
          output.append(text);
        } });
      },
    );
    output.appendLine(`outskirts exited with status ${String(run.exitCode)}.`);
    const findings = toFindings(interpretRun(run), cwd);
    showFindings(collection, findings, severity);
    void announce(findings.length);
  } catch (error) {
    await report(error, output);
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
