import * as assert from "node:assert/strict";
import * as path from "node:path";
import { summarizeProject, SummaryFileSystem } from "../../src/projectSummary";

function fakeFileSystem(tree: Record<string, string>): SummaryFileSystem & { reads: string[] } {
  const root = "/p";
  const reads: string[] = [];
  const relative = (absolute: string): string => path.relative(root, absolute).split(path.sep).join("/");
  return {
    reads,
    list: (directory) => {
      const prefix = relative(directory) === "" ? "" : `${relative(directory)}/`;
      const names = new Map<string, boolean>();
      for (const file of Object.keys(tree)) {
        if (file.startsWith(prefix)) {
          const [name, ...rest] = file.slice(prefix.length).split("/");
          names.set(name, (names.get(name) ?? false) || rest.length > 0);
        }
      }
      return Promise.resolve([...names].map(([name, directory]) => ({ name, directory, file: !directory })));
    },
    size: (file) => Promise.resolve(tree[relative(file)].length),
    read: (file) => {
      reads.push(relative(file));
      return Promise.resolve(tree[relative(file)]);
    },
  };
}

describe("summarizeProject", () => {
  it("lists the files, counts the signals of the Swift sources and reads the manifest", async () => {
    const fileSystem = fakeFileSystem({
      "Package.swift": '.library(name: "Kit", targets: [])',
      "Sources/Kit/Model.swift": "struct Model: Codable {}",
      "Sources/Kit/Bridge.swift": "@objc class Bridge: NSObject {}",
      "Tests/KitTests/ModelTests.swift": "import XCTest",
      ".build/debug/Gen.swift": "struct Gen: Codable {}",
      "Pods/Lib/Lib.swift": "struct Lib: Codable {}",
      "DerivedData/x.swift": "",
      "node_modules/a/b.swift": "",
    });
    const summary = await summarizeProject("/p", fileSystem);
    assert.deepEqual(summary.files, ["Package.swift", "Sources/Kit/Bridge.swift", "Sources/Kit/Model.swift", "Tests/KitTests/ModelTests.swift"]);
    assert.deepEqual(summary.signals, { codable: 1, objc: 1, tests: 1 });
    assert.equal(summary.manifest, '.library(name: "Kit", targets: [])');
    assert.equal(summary.truncated, false);
  });

  it("stops at the file cap, skips large files and caps the files it reads", async () => {
    const tree: Record<string, string> = { "Big.swift": `struct Big: Codable {}${" ".repeat(100)}` };
    for (let index = 0; index < 20; index++) {
      tree[`F${String(index).padStart(2, "0")}.swift`] = "struct S: Codable {}";
    }
    const fileSystem = fakeFileSystem(tree);
    const summary = await summarizeProject("/p", fileSystem, { files: 10, readFiles: 4, readBytes: 50, depth: 5 });
    assert.equal(summary.files.length, 10);
    assert.equal(summary.truncated, true);
    assert.equal(fileSystem.reads.length, 3);
    assert.deepEqual(summary.signals, { codable: 3 });
  });
});
