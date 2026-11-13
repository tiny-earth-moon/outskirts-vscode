export function parseVersion(stdout: string): string | undefined {
  return /\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/.exec(stdout.trim().split("\n")[0] ?? "")?.[0];
}
