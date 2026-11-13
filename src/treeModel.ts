import * as path from "node:path";
import { Finding } from "./findings";

export type GroupBy = "file" | "kind";

export interface ResultGroup {
  key: string;
  folder?: string;
  label: string;
  description?: string;
  findings: Finding[];
}

const hintLabels: Partial<Record<string, string>> = {
  unused: "Unused",
  assignOnlyProperty: "Assign-only property",
  unassignedOptionalProperty: "Unassigned optional property",
  redundantProtocol: "Redundant protocol",
  redundantPublicAccessibility: "Redundant public accessibility",
  redundantOpenAccessibility: "Redundant open accessibility",
  missingFinal: "Missing final",
  redundantAccessLevel: "Redundant access level",
  emptyExtension: "Empty extension",
  superfluousIgnoreCommand: "Superfluous ignore comment",
  unusedImport: "Unused import",
};

export function hintLabel(code: string | undefined): string {
  if (code === undefined) {
    return "Other";
  }
  const known = hintLabels[code];
  if (known !== undefined) {
    return known;
  }
  const words = code.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function groupFindings(findings: readonly Finding[], groupBy: GroupBy, root?: string, folder?: string): ResultGroup[] {
  const groups = new Map<string, ResultGroup>();
  for (const finding of findings) {
    const key = groupBy === "file" ? finding.file : (finding.code ?? "");
    let group = groups.get(key);
    if (group === undefined) {
      group = groupBy === "file" ? fileGroup(finding.file, root) : { key, label: hintLabel(finding.code), findings: [] };
      group.folder = folder;
      groups.set(key, group);
    }
    group.findings.push(finding);
  }
  const sorted = [...groups.values()].sort((a, b) => compare(a.label, b.label) || compare(a.key, b.key));
  for (const group of sorted) {
    group.findings.sort(compareFindings);
  }
  return sorted;
}

export function leafLabel(finding: Finding): string {
  return finding.name;
}

export function leafDescription(finding: Finding, groupBy: GroupBy, stale = false): string {
  const line = `line ${String(finding.line + 1)}`;
  const suffix = stale ? " · stale" : "";
  if (groupBy === "file") {
    return `${hintLabel(finding.code).toLowerCase()} ${finding.kind} · ${line}${suffix}`;
  }
  return `${finding.kind} · ${path.basename(finding.file)} · ${line}${suffix}`;
}

export function groupDescription(group: ResultGroup, stale: boolean): string {
  const parts = [group.description, String(group.findings.length), stale ? "changed since scan" : undefined];
  return parts.filter((part) => part !== undefined).join(" · ");
}

function fileGroup(file: string, root: string | undefined): ResultGroup {
  const relative = root === undefined ? undefined : path.relative(root, file);
  const dir = relative === undefined || relative.startsWith("..") ? path.dirname(file) : path.dirname(relative);
  return { key: file, label: path.basename(file), description: dir === "." ? undefined : dir, findings: [] };
}

export function compareFindings(a: Finding, b: Finding): number {
  return compare(a.file, b.file) || a.line - b.line || a.column - b.column || compare(a.message, b.message);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
