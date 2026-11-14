import * as assert from "node:assert/strict";
import { editorHtml, makeNonce } from "../../src/configEditorHtml";

describe("editorHtml", () => {
  const html = editorHtml({
    cspSource: "https://file+.vscode-resource.example",
    nonce: "abc123",
    script: "https://file+.vscode-resource.example/dist/configEditor.js",
    style: "https://file+.vscode-resource.example/dist/configEditor.css",
    title: "outskirts <App>",
  });

  it("allows only the scripts with the nonce and the styles of the extension", () => {
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
    assert.equal(
      csp,
      "default-src &#39;none&#39;; style-src https://file+.vscode-resource.example; script-src &#39;nonce-abc123&#39;; " +
        "font-src https://file+.vscode-resource.example; img-src https://file+.vscode-resource.example",
    );
    assert.match(html, /<script nonce="abc123" src="https:\/\/file\+\.vscode-resource\.example\/dist\/configEditor\.js"><\/script>/);
  });

  it("has no inline script, inline handler or remote resource, and escapes the title", () => {
    assert.equal((html.match(/<script/g) ?? []).length, 1);
    assert.doesNotMatch(html, /\son[a-z]+=/i);
    assert.doesNotMatch(html, /https?:\/\/(?!file\+\.vscode-resource)/);
    assert.match(html, /<title>outskirts &#60;App&#62;<\/title>/);
  });

  it("makes a new random nonce each time", () => {
    assert.notEqual(makeNonce(), makeNonce());
    assert.match(makeNonce(), /^[A-Za-z0-9+/]{24}$/);
  });
});
