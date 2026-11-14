import * as vscode from "vscode";
import { Finding } from "./findings";
import { Project } from "./project";
import { ResultsStore } from "./resultsStore";
import {
  isSeverityName,
  parseSeverityByKind,
  resolveSeverity,
  SeverityOverrides,
} from "./severityByKind";

const severities: Partial<Record<string, vscode.DiagnosticSeverity>> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

export function severityFromSetting(value: string): vscode.DiagnosticSeverity {
  const severity = severities[value];
  if (severity === undefined) {
    throw new Error(
      `Invalid value '${value}' for the setting outskirts.severity.`,
    );
  }
  return severity;
}

export function severityOverrides(
  uri: vscode.Uri | undefined,
  log?: (message: string) => void,
): SeverityOverrides {
  const overrides = parseSeverityByKind(
    vscode.workspace
      .getConfiguration("outskirts", uri)
      .get<unknown>("severityByKind"),
  );
  if (log !== undefined && overrides.invalid.length > 0) {
    log(
      `Ignored invalid values of outskirts.severityByKind (using outskirts.severity): ${overrides.invalid.join(", ")}`,
    );
  }
  return overrides;
}

export interface BoundDiagnostics extends vscode.Disposable {
  render(): void;
}

export function bindDiagnostics(
  collection: vscode.DiagnosticCollection,
  store: ResultsStore,
  overrides: (key: string) => SeverityOverrides = () =>
    parseSeverityByKind(undefined),
): BoundDiagnostics {
  const render = (): void => {
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const [key, entry] of store.all()) {
      severityFromSetting(entry.severity);
      const fallback = isSeverityName(entry.severity)
        ? entry.severity
        : "warning";
      const kinds = overrides(key);
      addFindings(
        byFile,
        entry.findings.filter((finding) => !entry.stale.has(finding.file)),
        (finding) => {
          const resolved = resolveSeverity(finding, fallback, kinds);
          return resolved === "off" ? undefined : severityFromSetting(resolved);
        },
      );
    }
    collection.clear();
    collection.set(
      [...byFile].map(([file, list]) => [vscode.Uri.file(file), list]),
    );
  };
  const subscription = store.onDidChange(render);
  return {
    render,
    dispose: () => {
      subscription.dispose();
    },
  };
}

export function followSeverity(
  store: ResultsStore,
  projects: () => readonly Project[],
  onKindsChanged: () => void = () => undefined,
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    const invalid = new Set<string>();
    let kindsChanged = false;
    for (const project of projects()) {
      if (
        event.affectsConfiguration(
          "outskirts.severityByKind",
          project.workspaceFolder.uri,
        )
      ) {
        kindsChanged = true;
      }
      if (
        !event.affectsConfiguration(
          "outskirts.severity",
          project.workspaceFolder.uri,
        )
      ) {
        continue;
      }
      const severity = vscode.workspace
        .getConfiguration("outskirts", project.workspaceFolder.uri)
        .get<string>("severity", "warning");
      if (severities[severity] === undefined) {
        invalid.add(severity);
      } else {
        store.setSeverity(project.key, severity);
      }
    }
    for (const severity of invalid) {
      void vscode.window.showErrorMessage(
        `Invalid value '${severity}' for the setting outskirts.severity.`,
      );
    }
    if (kindsChanged) {
      onKindsChanged();
    }
  });
}

function addFindings(
  byFile: Map<string, vscode.Diagnostic[]>,
  findings: readonly Finding[],
  severity: (finding: Finding) => vscode.DiagnosticSeverity | undefined,
): void {
  for (const finding of findings) {
    const level = severity(finding);
    if (level === undefined) {
      continue;
    }
    const position = new vscode.Position(finding.line, finding.column);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(position, position),
      finding.message,
      level,
    );
    diagnostic.source = "outskirts";
    if (finding.code !== undefined) {
      diagnostic.code = finding.code;
    }
    const list = byFile.get(finding.file) ?? [];
    list.push(diagnostic);
    byFile.set(finding.file, list);
  }
}
