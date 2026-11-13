import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const root = path.resolve(__dirname, "../../..");
  const workspaces = [
    { suite: "scan", target: "test/integration/fixture-workspace" },
    { suite: "multiRoot", target: "test/integration/multi-root.code-workspace" },
  ];
  for (const { suite, target } of workspaces) {
    await runTests({
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(__dirname, "suite", "index.js"),
      extensionTestsEnv: { OUTSKIRTS_SUITE: suite },
      launchArgs: [path.join(root, target), "--disable-extensions", "--disable-workspace-trust"],
    });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
