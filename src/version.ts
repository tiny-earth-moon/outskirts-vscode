export function parseVersion(stdout: string): string | undefined {
  return /\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/.exec(stdout.trim().split("\n")[0] ?? "")?.[0];
}

export function printsResultsWhenAsked(version: string): boolean {
  const core = /^\d+\.\d+(?:\.\d+)?/.exec(version)?.[0];
  if (core === undefined) {
    return false;
  }
  const [major = 0, minor = 0, patch = 0] = core.split(".").map(Number);
  return major > 3 || (major === 3 && (minor > 24 || (minor === 24 && patch > 0)));
}
