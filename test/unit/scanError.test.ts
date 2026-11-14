import * as assert from "node:assert/strict";
import { ExecutableNotFoundError } from "../../src/commandPath";
import { FolderNode } from "../../src/folderModel";
import { isErrorNode, treeChildren, TreeContext } from "../../src/folderTree";
import { interpretRun } from "../../src/outcome";
import { parseResults } from "../../src/results";
import { errorContextValue, errorNodeFields, failureToast, firstSentence, fixCommands, ScanError, scanError, wrappedMarkdown } from "../../src/scanError";

function thrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  assert.fail("expected an error");
}

const app = { key: "file:///app", name: "App", root: "/app" };
const library = { key: "file:///library", name: "Library", root: "/library" };
const failure: ScanError = { message: "outskirts exited with status 1.\nboom", fixes: [] };

function context(folders: TreeContext["folders"], errors: [string, ScanError][]): TreeContext {
  return { folders, results: new Map(), groupBy: "file", scanning: undefined, now: 0, errors: new Map(errors) };
}

describe("scanError", () => {
  it("offers the arguments and the configuration file when stdout has no results", () => {
    const error = scanError(thrown(() => parseResults("")));
    assert.deepEqual(error.fixes, ["arguments", "configuration"]);
    assert.equal(errorContextValue(error), "scanError.fixable");
    assert.equal(
      errorNodeFields(error).label,
      "outskirts printed no results, not even [] for none, so they went elsewhere: remove --skip-stdout-results from Extra arguments, or skip_stdout_results from the configuration file.",
    );
  });

  it("offers a fix for a known stderr hint and none for an unknown failure", () => {
    const hinted = thrown(() => interpretRun({ exitCode: 1, stdout: "", stderr: "Error: Failed to identify project.\n" }));
    assert.deepEqual(scanError(hinted).fixes, ["arguments", "configuration"]);
    const plain = scanError(thrown(() => interpretRun({ exitCode: 2, stdout: "", stderr: "crash\n" })));
    assert.deepEqual(plain.fixes, []);
    assert.equal(errorContextValue(plain), "scanError");
  });

  it("adds the install hint to a missing executable", () => {
    const error = scanError(new ExecutableNotFoundError("outskirts"));
    assert.match(error.message, /was not found\. Install it with/);
    assert.deepEqual(error.fixes, []);
  });

  it("labels the node with the first sentence and keeps the full message as tooltip", () => {
    assert.deepEqual(errorNodeFields(failure), { label: "outskirts exited with status 1.", description: "scan failed", tooltip: failure.message });
    assert.equal(firstSentence("one. two."), "one.");
    assert.equal(firstSentence("no period"), "no period");
    assert.equal(firstSentence("v3.1 crashed"), "v3.1 crashed");
  });

  it("maps each fix to its setting or the configuration editor", () => {
    assert.deepEqual([fixCommands.arguments.command, fixCommands.arguments.arguments("k")], ["workbench.action.openSettings", ["outskirts.arguments"]]);
    assert.deepEqual([fixCommands.configuration.command, fixCommands.configuration.arguments("k")], ["outskirts.editConfiguration", [{ key: "k" }]]);
  });

  it("escapes Markdown and keeps line breaks without non-breaking spaces", () => {
    assert.equal(wrappedMarkdown("not even [] for none\nskip_stdout"), "not even \\[\\] for none  \nskip\\_stdout");
  });

  it("names the project in the short toast", () => {
    assert.equal(failureToast("Demo"), "outskirts: scan of Demo failed");
  });
});

describe("treeChildren with a failed scan", () => {
  it("shows the error at the top with one project, even without results", () => {
    const [node, ...rest] = treeChildren(context([app], [[app.key, failure]]));
    assert.equal(rest.length, 0);
    assert.ok(isErrorNode(node));
    assert.equal(node.key, app.key);
  });

  it("marks the failed project and lists the error under it with several", () => {
    const tree = context([app, library], [[library.key, failure]]);
    const nodes = treeChildren(tree) as FolderNode[];
    assert.deepEqual(nodes.map((node) => [node.name, node.description, node.expanded]), [["App", "not scanned", false], ["Library", "scan failed", true]]);
    assert.ok(isErrorNode(treeChildren(tree, nodes[1])[0]));
    assert.equal(treeChildren(tree, nodes[0]).length, 0);
  });

  it("shows nothing once the error is forgotten", () => {
    assert.deepEqual(treeChildren(context([app], [])), []);
  });
});
