export function parseVersion(stdout: string): string | undefined {
  return /\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/.exec(stdout.trim().split("\n")[0] ?? "")?.[0];
}

export function printsResultsWhenAsked(version: string): boolean {
  return isAtLeast(version, [3, 24, 1]);
}

export function printsAbsolutePathsWhenAsked(version: string): boolean {
  return isAtLeast(version, [3, 13, 3]);
}

function isAtLeast(version: string, minimum: readonly [number, number, number]): boolean {
  const core = /^\d+\.\d+(?:\.\d+)?/.exec(version)?.[0];
  if (core === undefined) {
    return false;
  }
  const [major = 0, minor = 0, patch = 0] = core.split(".").map(Number);
  const [wantedMajor, wantedMinor, wantedPatch] = minimum;
  return major !== wantedMajor ? major > wantedMajor : minor !== wantedMinor ? minor > wantedMinor : patch >= wantedPatch;
}
