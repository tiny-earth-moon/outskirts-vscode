import { access } from "node:fs/promises";
import * as path from "node:path";
import { isRelativeLocation } from "./location";
import { ScanResult } from "./results";

export class UnresolvedPathError extends Error {}

export async function checkRelativeLocations(results: readonly ScanResult[], base: string): Promise<void> {
  const files = new Set(results.filter((result) => isRelativeLocation(result.location)).map((result) => result.location.replace(/:\d+:\d+$/, "")));
  for (const file of files) {
    try {
      await access(path.resolve(base, file));
    } catch {
      throw new UnresolvedPathError(
        `outskirts printed the result path '${file}' relative to a folder other than ${base}, where it does not exist. ` +
          "Remove --relative-results from Extra arguments, or pass --relative-to with it.",
      );
    }
  }
}
