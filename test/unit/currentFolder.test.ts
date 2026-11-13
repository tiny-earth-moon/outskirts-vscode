import * as assert from "node:assert/strict";
import { CurrentFolder } from "../../src/currentFolder";

describe("CurrentFolder", () => {
  it("shows the only folder", () => {
    const current = new CurrentFolder();
    current.setFolders(["app"]);
    assert.equal(current.current, "app");
    assert.equal(current.several, false);
  });

  it("starts on the first of several folders and follows a selection", () => {
    const current = new CurrentFolder();
    current.setFolders(["app", "library"]);
    assert.equal(current.current, "app");
    assert.equal(current.several, true);
    assert.equal(current.select("library"), true);
    assert.equal(current.current, "library");
    assert.equal(current.select("library"), false);
  });

  it("ignores an unknown folder, such as the last scanned one once removed", () => {
    const current = new CurrentFolder();
    current.setFolders(["app", "library"]);
    assert.equal(current.select("other"), false);
    assert.equal(current.current, "app");
  });

  it("falls back to the first folder when the current one is removed", () => {
    const current = new CurrentFolder();
    current.setFolders(["app", "library"]);
    current.select("library");
    current.setFolders(["app"]);
    assert.equal(current.current, "app");
    current.setFolders([]);
    assert.equal(current.current, undefined);
  });
});
