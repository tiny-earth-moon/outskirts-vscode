import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { draftBannerText, makeDraft, restoreDraft, textHash } from "../../src/configDraft";
import { parseSchema } from "../../src/configSchema";

const { options } = parseSchema(readFileSync(path.join(__dirname, "../../../test/fixtures/config-schema.json"), "utf8"));
const text = "strict: true\n";
const saved = { strict: true };

describe("textHash", () => {
  it("tells two texts apart and gives the same hash to the same text", () => {
    assert.equal(textHash(text), textHash("strict: true\n"));
    assert.notEqual(textHash(text), textHash("strict: false\n"));
    assert.notEqual(textHash(""), textHash(" "));
  });
});

describe("makeDraft", () => {
  it("keeps nothing without changes", () => {
    assert.equal(makeDraft(null, text), undefined);
    assert.equal(makeDraft({}, text), undefined);
    assert.deepEqual(makeDraft({ quiet: true }, text), { changes: { quiet: true }, base: textHash(text) });
  });
});

describe("restoreDraft", () => {
  it("restores the changes made on the same file", () => {
    const draft = makeDraft({ quiet: true, strict: null }, text);
    assert.deepEqual(restoreDraft(draft, text, options, saved, new Set()), { changes: { quiet: true, strict: null }, changedOnDisk: false });
  });

  it("says when the file changed on disk and drops the changes the file already has", () => {
    const draft = makeDraft({ quiet: true, format: "json" }, text);
    const restored = restoreDraft(draft, "strict: true\nquiet: true\n", options, { strict: true, quiet: true }, new Set());
    assert.deepEqual(restored, { changes: { format: "json" }, changedOnDisk: true });
    assert.equal(restoreDraft(makeDraft({ quiet: true }, text), "quiet: true\n", options, { quiet: true }, new Set()), undefined);
  });

  it("drops unknown keys, values the form cannot edit and malformed drafts", () => {
    const draft = { changes: { quiet: true, gone_option: true, report_exclude: ["a"], format: { odd: 1 } }, base: textHash(text) };
    assert.deepEqual(restoreDraft(draft, text, options, saved, new Set(["report_exclude"]))?.changes, { quiet: true });
    assert.equal(restoreDraft(undefined, text, options, saved, new Set()), undefined);
    assert.equal(restoreDraft({ changes: "x", base: 1 }, text, options, saved, new Set()), undefined);
  });
});

describe("draftBannerText", () => {
  it("counts the restored options and warns about a file changed on disk", () => {
    assert.equal(draftBannerText({ changes: { quiet: true }, changedOnDisk: false }, ".outskirts.yml"), "Unsaved changes restored (1 option).");
    assert.equal(
      draftBannerText({ changes: { quiet: true, strict: null }, changedOnDisk: true }, ".outskirts.yml"),
      "Unsaved changes restored (2 options). .outskirts.yml changed on disk since they were made: check them before saving.",
    );
  });
});
