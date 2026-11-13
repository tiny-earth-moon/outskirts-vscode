import { readFile } from "node:fs/promises";
import { Finding } from "./findings";
import { utf16Column } from "./location";

export async function toEditorColumns(findings: readonly Finding[], log: (message: string) => void): Promise<Finding[]> {
  const files = [...new Set(findings.filter((finding) => finding.column > 0).map((finding) => finding.file))];
  const lines = new Map<string, string[]>();
  for (const file of files) {
    try {
      lines.set(file, (await readFile(file, "utf8")).split(/\r\n|\r|\n/));
    } catch (error) {
      log(`Cannot read ${file} to place the columns of its results: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return findings.map((finding) => {
    const line = lines.get(finding.file)?.[finding.line];
    return line === undefined ? finding : { ...finding, column: utf16Column(line, finding.column) };
  });
}
