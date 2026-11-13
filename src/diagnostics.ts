import * as vscode from "vscode";
import { Finding } from "./findings";
import { Project } from "./project";
import { ResultsStore } from "./resultsStore";

const severities: Partial<Record<string, vscode.DiagnosticSeverity>> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

export function severityFromSetting(value: string): vscode.DiagnosticSeverity {
  const severity = severities[value];
  if (severity === undefined) {
    throw new Error(`Invalid value '${value}' for the setting outskirts.severity.`);
  }
  return severity;
}

export function bindDiagnostics(collection: vscode.DiagnosticCollection, store: ResultsStore): vscode.Disposable {
  return store.onDidChange(() => {
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const entry of store.all().values()) {
      addFindings(byFile, entry.findings.filter((finding) => !entry.stale.has(finding.file)), severityFromSetting(entry.severity));
    }
    collection.clear();
    collection.set([...byFile].map(([file, list]) => [vscode.Uri.file(file), list]));
  });
}

export function followSeverity(store: ResultsStore, projects: () => readonly Project[]): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    const invalid = new Set<string>();
    for (const project of projects()) {
      if (!event.affectsConfiguration("outskirts.severity", project.workspaceFolder.uri)) {
        continue;
      }
      const severity = vscode.workspace.getConfiguration("outskirts", project.workspaceFolder.uri).get<string>("severity", "warning");
      if (severities[severity] === undefined) {
        invalid.add(severity);
      } else {
        store.setSeverity(project.key, severity);
      }
    }
    for (const severity of invalid) {
      void vscode.window.showErrorMessage(`Invalid value '${severity}' for the setting outskirts.severity.`);
    }
  });
}

function addFindings(
  byFile: Map<string, vscode.Diagnostic[]>,
  findings: readonly Finding[],
  severity: vscode.DiagnosticSeverity,
): void {
  for (const finding of findings) {
    const position = new vscode.Position(finding.line, finding.column);
    const diagnostic = new vscode.Diagnostic(new vscode.Range(position, position), finding.message, severity);
    diagnostic.source = "outskirts";
    if (finding.code !== undefined) {
      diagnostic.code = finding.code;
    }
    const list = byFile.get(finding.file) ?? [];
    list.push(diagnostic);
    byFile.set(finding.file, list);
  }
}
