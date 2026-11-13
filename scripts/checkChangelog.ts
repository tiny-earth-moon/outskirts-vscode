import { readFileSync } from "node:fs";
import * as path from "node:path";

export function changelogProblem(version: string, changelog: string): string | undefined {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = new RegExp(`^## ${escaped} \\((\\d{4}-\\d{2}-\\d{2})\\)[ \\t]*\\r?$`, "m").exec(changelog);
  if (header === null) {
    return `CHANGELOG.md has no "## ${version} (YYYY-MM-DD)" section for the version of package.json.`;
  }
  const date = header[1];
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return `The section of ${version} in CHANGELOG.md has an invalid date, ${date}.`;
  }
  const rest = changelog.slice(header.index + header[0].length);
  const next = rest.search(/^## /m);
  if ((next === -1 ? rest : rest.slice(0, next)).trim() === "") {
    return `The section of ${version} in CHANGELOG.md is empty.`;
  }
  return undefined;
}

function main(root: string): number {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version?: unknown };
  if (typeof manifest.version !== "string") {
    console.error("package.json has no version.");
    return 1;
  }
  const problem = changelogProblem(manifest.version, readFileSync(path.join(root, "CHANGELOG.md"), "utf8"));
  if (problem !== undefined) {
    console.error(problem);
    return 1;
  }
  console.log(`CHANGELOG.md has a dated section for ${manifest.version}.`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv[2] ?? process.cwd());
}
