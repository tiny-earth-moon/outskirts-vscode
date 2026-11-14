import * as assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ConfigEditorPanel } from "../../../src/configEditor";
import type { HostMessage } from "../../../src/configMessages";
import { activateWithFake, root } from "./activate";

type Message<T extends HostMessage["type"]> = Extract<HostMessage, { type: T }>;

function last<T extends HostMessage["type"]>(panel: ConfigEditorPanel, type: T): Message<T> | undefined {
  return panel.messages().get(type) as Message<T> | undefined;
}

async function waitFor(condition: () => boolean, timeout = 10_000): Promise<void> {
  const end = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > end) {
      throw new Error("Timed out waiting for the condition.");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export function describeConfigEditor(): void {
  describe("outskirts.editConfiguration", () => {
    const folder = path.join(root, "test/integration/fixture-workspace");
    const file = path.join(folder, ".outskirts.yml");

    afterEach(async () => {
      rmSync(file, { force: true });
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    });

    it("edits the configuration file from the schema of outskirts, keeping comments and unknown keys", async () => {
      await activateWithFake();
      const panel = await vscode.commands.executeCommand<ConfigEditorPanel | undefined>("outskirts.editConfiguration", vscode.Uri.file(folder));
      assert.ok(panel);
      await panel.current;
      const opened = last(panel, "state");
      assert.ok(opened);
      assert.equal(opened.state.options.length, 78);
      assert.equal(opened.state.fileExists, false);
      assert.equal(opened.state.version, "3.24.0");
      const recommendations = last(panel, "recommendations");
      assert.equal(recommendations?.scanning, false);
      assert.equal(recommendations.recommendations[0]?.id, "create");

      await panel.receive({ type: "save", changes: { strict: true, schemes: ["Demo"] } });
      const created = readFileSync(file, "utf8");
      assert.match(created, /^# yaml-language-server: \$schema=/);
      assert.match(created, /\nschemes:\n {2}- Demo\nstrict: true\n$/);
      assert.equal(last(panel, "check")?.result.state, "valid");

      writeFileSync(file, "# Kept comment\nstrict: true # inline\nunknown_key: 1\nquiet: true\n");
      await waitFor(() => last(panel, "state")?.state.saved.quiet === true);
      await panel.current;
      const external = last(panel, "state");
      assert.equal(external?.reason, "external");
      assert.deepEqual(external.state.other, [{ key: "unknown_key", text: "unknown_key: 1" }]);
      assert.deepEqual(last(panel, "check")?.result, { state: "problems", messages: ["invalid key 'unknown_key'"] });

      await panel.receive({ type: "save", changes: { strict: null, format: "json" } });
      assert.equal(readFileSync(file, "utf8"), "# Kept comment\nunknown_key: 1\nquiet: true\nformat: json\n");
      assert.deepEqual(last(panel, "state")?.state.saved, { quiet: true, format: "json" });
    });

    it("reopens the same editor for the same folder, remembers dismissals and creates nothing until saved", async () => {
      await activateWithFake();
      const other = mkdtempSync(path.join(os.tmpdir(), "outskirts-config-"));
      try {
        const first = await vscode.commands.executeCommand<ConfigEditorPanel | undefined>("outskirts.editConfiguration", vscode.Uri.file(other));
        const second = await vscode.commands.executeCommand<ConfigEditorPanel | undefined>("outskirts.editConfiguration", other);
        assert.ok(first);
        assert.equal(second, first);
        await first.current;
        assert.equal(last(first, "recommendations")?.recommendations[0]?.id, "create");
        await first.receive({ type: "dismiss", id: "create" });
        assert.deepEqual(last(first, "recommendations")?.recommendations, []);
        assert.equal(existsSync(path.join(other, ".outskirts.yml")), false);
      } finally {
        rmSync(other, { recursive: true, force: true });
      }
    });

    it("restores the unsaved changes of a closed editor and says when the file changed meanwhile", async () => {
      await activateWithFake();
      const other = mkdtempSync(path.join(os.tmpdir(), "outskirts-draft-"));
      const config = path.join(other, ".outskirts.yml");
      writeFileSync(config, "strict: true\n");
      try {
        const open = async (): Promise<ConfigEditorPanel> => {
          const panel = await vscode.commands.executeCommand<ConfigEditorPanel | undefined>("outskirts.editConfiguration", vscode.Uri.file(other));
          assert.ok(panel);
          await panel.current;
          return panel;
        };
        const first = await open();
        assert.equal(last(first, "state")?.state.draft, undefined);
        await first.receive({ type: "draft", changes: { quiet: true, strict: null } });
        first.dispose();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const second = await open();
        assert.notEqual(second, first);
        assert.deepEqual(last(second, "state")?.state.draft, { changes: { quiet: true, strict: null }, changedOnDisk: false });
        second.dispose();
        await new Promise((resolve) => setTimeout(resolve, 100));

        writeFileSync(config, "strict: true\nformat: json\n");
        const third = await open();
        assert.deepEqual(last(third, "state")?.state.draft, { changes: { quiet: true, strict: null }, changedOnDisk: true });
        await third.receive({ type: "save", changes: { quiet: true } });
        assert.equal(readFileSync(config, "utf8"), "strict: true\nformat: json\nquiet: true\n");
        third.dispose();
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(last(await open(), "state")?.state.draft, undefined);
      } finally {
        rmSync(other, { recursive: true, force: true });
      }
    });
  });
}
