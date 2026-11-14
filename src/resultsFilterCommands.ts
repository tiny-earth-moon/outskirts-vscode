import * as vscode from "vscode";
import { filterDescription, isActive, kindCounts, noFilter, parseFilter, ResultsFilter } from "./resultsFilter";
import { ResultNode, ResultsTreeProvider } from "./resultsTree";
import { ResultsStore } from "./resultsStore";

const stateKey = "outskirts.resultsFilter";

interface KindItem extends vscode.QuickPickItem {
  key: string;
}

export function registerResultsFilter(
  tree: ResultsTreeProvider,
  store: ResultsStore,
  view: vscode.TreeView<ResultNode>,
  state: vscode.Memento,
): vscode.Disposable[] {
  const allFindings = () => [...store.all().values()].flatMap((entry) => entry.findings);
  const update = (): void => {
    view.description = filterDescription(allFindings(), tree.filter);
    void vscode.commands.executeCommand("setContext", "outskirts.filtered", isActive(tree.filter));
  };
  const apply = async (filter: ResultsFilter): Promise<void> => {
    tree.filter = filter;
    update();
    await state.update(stateKey, isActive(filter) ? filter : undefined);
  };
  tree.filter = parseFilter(state.get(stateKey));
  update();
  const pick = async (): Promise<void> => {
    const current = tree.filter;
    const items: KindItem[] = kindCounts(allFindings()).map((kind) => ({
      key: kind.key,
      label: kind.label,
      description: String(kind.count),
      picked: current.kinds.includes(kind.key),
    }));
    let kinds = current.kinds;
    if (items.length > 0) {
      const picked = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        title: "Filter Results by Kind",
        placeHolder: "Select the kinds to show (none selected shows all)",
      });
      if (picked === undefined) {
        return;
      }
      kinds = picked.map((item) => item.key);
    }
    const text = await vscode.window.showInputBox({
      title: "Filter Results by Text",
      prompt: "Filter by name or path… (empty for none)",
      value: current.text,
    });
    if (text === undefined) {
      return;
    }
    await apply({ kinds, text });
  };
  return [
    store.onDidChange(update),
    vscode.commands.registerCommand("outskirts.filterResults", pick),
    vscode.commands.registerCommand("outskirts.filterResultsActive", pick),
    vscode.commands.registerCommand("outskirts.clearFilter", () => apply(noFilter)),
  ];
}
