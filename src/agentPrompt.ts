import * as path from "node:path";
import { Finding } from "./findings";
import { compareFindings, hintLabel } from "./treeModel";

export const maxPromptResults = 200;
export const maxPromptBytes = 100_000;

export interface PromptInput {
  projectName: string;
  root: string;
  findings: readonly Finding[];
  verify?: boolean;
}

const instructions = [
  "- Change nothing else.",
  "- If a declaration turns out to be used (dynamically, from another target, by Interface Builder, through reflection, etc.), keep it and report it instead of removing it.",
  "- For redundant accessibility and the other hints, apply the minimal change the hint names instead of removing the declaration.",
  "- Do not edit generated files.",
];

const checkInstructions = [
  "- Do not build the project or run its tests. Check each removal by searching the code for remaining uses, and end with a summary of what was removed, what was kept and why, and the command to run to verify.",
];

const verifyInstructions = [
  "- Afterwards, build the project or run its tests if there is a quick way to do so.",
  "- End with a summary of what you removed and what you kept, and why.",
];

export const replacementCharacter = "\uFFFD";

const subdivisionFlag = "\u{1F3F4}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,6}\u{E007F}";
const joinerBetweenLetters = "(?<=[\\p{L}\\p{M}\\p{Extended_Pictographic}\\p{Emoji_Modifier}\\u{FE0F}])[\\u{200C}\\u{200D}](?=[\\p{L}\\p{Extended_Pictographic}])";
const invisible = "([\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}\\u{115F}\\u{1160}\\u{3164}\\u{FFA0}]+)";
const sanitizePattern = new RegExp(`${subdivisionFlag}|${joinerBetweenLetters}|${invisible}`, "gu");

export function sanitize(text: string): string {
  return text.replace(sanitizePattern, (match: string, hidden: string | undefined) => (hidden === undefined ? match : replacementCharacter));
}

export function buildPrompt(input: PromptInput, limit = maxPromptResults): string {
  const sorted = [...input.findings].sort(compareFindings);
  const listed = sorted.slice(0, Math.max(limit, 0));
  const lines = [
    `Remove the unused Swift code listed below, found by outskirts in the project ${sanitize(input.projectName)}.`,
    "",
    ...instructions,
    ...(input.verify === true ? verifyInstructions : checkInstructions),
    "",
    "Results by file (paths relative to the project directory, then line:column):",
  ];
  let currentFile: string | undefined;
  for (const finding of listed) {
    if (finding.file !== currentFile) {
      currentFile = finding.file;
      lines.push("", sanitize(path.relative(input.root, finding.file)));
    }
    lines.push(resultLine(finding));
  }
  const left = sorted.length - listed.length;
  if (left > 0) {
    const results = left === 1 ? "1 more result was" : `${String(left)} more results were`;
    lines.push("", `${results} left out of this list; the scan can be run again after these changes to see them.`);
  }
  return lines.join("\n");
}

export function fitPrompt(input: PromptInput, maxBytes = maxPromptBytes, limit = maxPromptResults): string {
  let count = Math.min(limit, input.findings.length);
  for (;;) {
    const prompt = buildPrompt(input, count);
    const size = Buffer.byteLength(prompt, "utf8");
    if (size <= maxBytes || count === 0) {
      return prompt;
    }
    count = Math.max(Math.min(count - 1, Math.floor((count * maxBytes) / size)), 0);
  }
}

function resultLine(finding: Finding): string {
  const position = `${String(finding.line + 1)}:${String(finding.column + 1)}`;
  return `${position}  ${sanitize(finding.kind)} ${sanitize(finding.name)} — ${sanitize(hintLabel(finding.code).toLowerCase())}`;
}
