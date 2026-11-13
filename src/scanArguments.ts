export interface ScanOptions {
  skipBuild?: boolean;
  project?: readonly string[];
  printResults?: boolean;
}

export function buildScanArguments(extra: readonly string[], options: ScanOptions = {}): string[] {
  return [
    "scan",
    "--format",
    "json",
    "--quiet",
    ...(options.skipBuild === true ? ["--skip-build"] : []),
    ...(options.project ?? []),
    ...(options.printResults === true ? ["--no-skip-stdout-results"] : []),
    ...extra,
  ];
}
