export interface ScanResult {
  kind: string;
  name: string;
  hints: string[];
  location: string;
  accessibility?: string;
  modifiers?: string[];
  attributes?: string[];
  ids?: string[];
  modules?: string[];
}

export type FixTarget = "arguments" | "configuration";

export class InvalidOutputError extends Error {
  constructor(message: string, readonly fixes: readonly FixTarget[] = []) {
    super(message);
  }
}

export function parseResults(stdout: string, redirects: readonly FixTarget[] = ["arguments", "configuration"]): ScanResult[] {
  if (stdout.trim() === "") {
    if (redirects.length === 0) {
      return [];
    }
    throw new InvalidOutputError(
      "outskirts printed no results, not even [] for none, so they went elsewhere: remove --skip-stdout-results from Extra arguments, " +
        "or skip_stdout_results from the configuration file.",
      ["arguments", "configuration"],
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new InvalidOutputError(`outskirts printed invalid JSON: ${String(error)}`);
  }
  if (!Array.isArray(parsed)) {
    throw new InvalidOutputError("outskirts printed JSON that is not an array of results.");
  }
  return parsed.map((item, index) => validate(item, index));
}

function validate(item: unknown, index: number): ScanResult {
  if (typeof item !== "object" || item === null) {
    throw new InvalidOutputError(`Result ${String(index)} is not an object.`);
  }
  const record = item as Record<string, unknown>;
  for (const key of ["kind", "name", "location"]) {
    if (typeof record[key] !== "string") {
      throw new InvalidOutputError(`Result ${String(index)} has no string '${key}'.`);
    }
  }
  const hints = record.hints;
  if (!Array.isArray(hints) || !hints.every((hint) => typeof hint === "string")) {
    throw new InvalidOutputError(`Result ${String(index)} has no string array 'hints'.`);
  }
  return item as ScanResult;
}
