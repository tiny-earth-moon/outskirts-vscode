export function buildScanArguments(extra: readonly string[], skipBuild = false): string[] {
  return ["scan", "--format", "json", "--quiet", ...(skipBuild ? ["--skip-build"] : []), ...extra];
}
