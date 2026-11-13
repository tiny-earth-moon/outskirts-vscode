export function buildScanArguments(extra: readonly string[]): string[] {
  return ["scan", "--format", "json", "--quiet", ...extra];
}
