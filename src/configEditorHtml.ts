import { randomBytes } from "node:crypto";

export interface EditorPage {
  cspSource: string;
  nonce: string;
  script: string;
  style: string;
  title: string;
}

export function makeNonce(): string {
  return randomBytes(18).toString("base64");
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${String(character.charCodeAt(0))};`);
}

export function editorHtml(page: EditorPage): string {
  const csp = [
    "default-src 'none'",
    `style-src ${page.cspSource}`,
    `script-src 'nonce-${page.nonce}'`,
    `font-src ${page.cspSource}`,
    `img-src ${page.cspSource}`,
  ].join("; ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${escapeHtml(page.style)}">
<title>${escapeHtml(page.title)}</title>
</head>
<body>
<main id="app" aria-live="polite"><p class="loading">Loading the configuration…</p></main>
<script nonce="${escapeHtml(page.nonce)}" src="${escapeHtml(page.script)}"></script>
</body>
</html>
`;
}
