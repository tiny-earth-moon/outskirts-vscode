import { Finding } from "./findings";

export const severityNames = [
  "error",
  "warning",
  "information",
  "hint",
] as const;
export type SeverityName = (typeof severityNames)[number];
export type KindSeverity = SeverityName | "off";

export const severityKinds = [
  "unused",
  "assignOnlyProperty",
  "unassignedOptionalProperty",
  "redundantProtocol",
  "redundantConformance",
  "redundantPublicAccessibility",
  "redundantOpenAccessibility",
  "missingFinal",
  "redundantAccessLevel",
  "emptyExtension",
  "superfluousIgnoreCommand",
  "unusedImport",
  "unusedAssetCatalogColor",
  "unusedAssetCatalogImage",
  "missingMetalFunction",
];

export interface SeverityOverrides {
  readonly byKind: ReadonlyMap<string, KindSeverity>;
  readonly invalid: readonly string[];
}

export function isSeverityName(value: unknown): value is SeverityName {
  return (
    typeof value === "string" &&
    (severityNames as readonly string[]).includes(value)
  );
}

export function severityKind(finding: Finding): string {
  return finding.code ?? "unused";
}

export function parseSeverityByKind(value: unknown): SeverityOverrides {
  const byKind = new Map<string, KindSeverity>();
  const invalid: string[] = [];
  if (value === undefined || value === null) {
    return { byKind, invalid };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { byKind, invalid: [JSON.stringify(value)] };
  }
  for (const [kind, severity] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (isSeverityName(severity) || severity === "off") {
      byKind.set(kind, severity);
    } else {
      invalid.push(`${kind}: ${JSON.stringify(severity)}`);
    }
  }
  return { byKind, invalid };
}

export function resolveSeverity(
  finding: Finding,
  fallback: SeverityName,
  overrides: SeverityOverrides,
): KindSeverity {
  return overrides.byKind.get(severityKind(finding)) ?? fallback;
}

export function severityDescription(
  severity: string,
  overrides: SeverityOverrides,
): string {
  const count = overrides.byKind.size;
  if (count === 0) {
    return severity;
  }
  return `${severity} · ${String(count)} ${count === 1 ? "override" : "overrides"}`;
}
