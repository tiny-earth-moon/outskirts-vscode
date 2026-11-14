import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { shouldOpenWalkthrough, walkthroughId } from "../../src/walkthroughState";

interface Step { id: string; description: string; media: { markdown?: string; image?: string } }
const root = path.join(__dirname, "../../..");
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  publisher: string;
  name: string;
  contributes: { commands: { command: string }[]; walkthroughs: { id: string; steps: Step[] }[] };
};
const commands = new Set(manifest.contributes.commands.map((entry) => entry.command));
const vscodeignore = readFileSync(path.join(root, ".vscodeignore"), "utf8");

describe("walkthrough", () => {
  it("asks to install outskirts only once the probe found it missing", () => {
    const welcome = (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      contributes: { viewsWelcome: { contents: string; when: string }[] };
    }).contributes.viewsWelcome.filter((entry) => entry.contents.includes("outskirts.installExecutable"));
    assert.equal(welcome.length, 1);
    assert.match(welcome[0].when, /(^|&& )outskirts\.executableMissing( |$)/);
    assert.doesNotMatch(welcome[0].when, /!outskirts\.executableFound/);
  });

  it("opens once after install and never in tests", () => {
    assert.equal(shouldOpenWalkthrough(false, false), true);
    assert.equal(shouldOpenWalkthrough(true, false), false);
    assert.equal(shouldOpenWalkthrough(false, true), false);
  });

  it("is the walkthrough of the manifest", () => {
    const [walkthrough] = manifest.contributes.walkthroughs;
    assert.equal(walkthroughId, `${manifest.publisher}.${manifest.name}#${walkthrough.id}`);
  });

  it("names existing commands and packaged media in every step", () => {
    for (const step of manifest.contributes.walkthroughs[0].steps) {
      for (const [, command] of step.description.matchAll(/\(command:([\w.]+)/g)) {
        assert.ok(command.startsWith("workbench.") || commands.has(command), `${step.id}: ${command}`);
      }
      const media = step.media.markdown ?? step.media.image ?? "";
      assert.ok(media !== "" && existsSync(path.join(root, media)), `${step.id}: ${media}`);
      assert.match(vscodeignore, new RegExp(`^!${path.dirname(media)}/\\*\\.md$`, "m"), step.id);
    }
  });
});
