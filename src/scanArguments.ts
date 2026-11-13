export interface ScanOptions {
  skipBuild?: boolean;
  project?: readonly string[];
}

export function buildScanArguments(extra: readonly string[], options: ScanOptions = {}): string[] {
  return ["scan", "--format", "json", "--quiet", ...(options.skipBuild === true ? ["--skip-build"] : []), ...(options.project ?? []), ...extra];
}
