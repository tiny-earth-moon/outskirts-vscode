import { Finding } from "./findings";
import { hintLabel, isKnownHint } from "./treeModel";

export interface ResultsFilter {
  readonly kinds: readonly string[];
  readonly text: string;
}

export interface KindCount {
  key: string;
  label: string;
  count: number;
}

export const noFilter: ResultsFilter = { kinds: [], text: "" };

export function isActive(filter: ResultsFilter): boolean {
  return filter.kinds.length > 0 || filter.text.trim() !== "";
}

export function kindKey(finding: Finding): string {
  return finding.code === "unused" ? `unused:${finding.kind}` : (finding.code ?? "");
}

export function kindLabel(finding: Finding): string {
  if (finding.code === "unused") {
    return `Unused ${finding.kind}`;
  }
  if (finding.code === undefined || isKnownHint(finding.code)) {
    return hintLabel(finding.code);
  }
  return finding.code;
}

export function kindCounts(findings: readonly Finding[]): KindCount[] {
  const counts = new Map<string, KindCount>();
  for (const finding of findings) {
    const key = kindKey(finding);
    const entry = counts.get(key) ?? { key, label: kindLabel(finding), count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function matches(finding: Finding, filter: ResultsFilter): boolean {
  if (filter.kinds.length > 0 && !filter.kinds.includes(kindKey(finding))) {
    return false;
  }
  const text = filter.text.trim().toLowerCase();
  return text === "" || finding.name.toLowerCase().includes(text) || finding.file.toLowerCase().includes(text);
}

export function filterFindings(findings: readonly Finding[], filter: ResultsFilter): readonly Finding[] {
  return isActive(filter) ? findings.filter((finding) => matches(finding, filter)) : findings;
}

export function filterDescription(findings: readonly Finding[], filter: ResultsFilter): string | undefined {
  if (!isActive(filter)) {
    return undefined;
  }
  return `Filtered: ${String(filterFindings(findings, filter).length)} of ${String(findings.length)}`;
}

export function parseFilter(value: unknown): ResultsFilter {
  if (typeof value !== "object" || value === null) {
    return noFilter;
  }
  const record = value as Record<string, unknown>;
  const kinds = Array.isArray(record.kinds) ? record.kinds.filter((kind): kind is string => typeof kind === "string") : [];
  const text = typeof record.text === "string" ? record.text : "";
  return { kinds, text };
}
