import { Finding } from "./findings";
import { FolderInfo, FolderNode, folderNode, viewState } from "./folderModel";
import { FolderResults } from "./resultsStore";
import { GroupBy, groupFindings, ResultGroup } from "./treeModel";

export type TreeNode = FolderNode | ResultGroup | Finding;

export interface TreeContext {
  folders: readonly FolderInfo[];
  results: ReadonlyMap<string, FolderResults>;
  groupBy: GroupBy;
  scanning: string | undefined;
  now: number;
}

export function isFolderNode(node: TreeNode): node is FolderNode {
  return "type" in node;
}

export function isResultGroup(node: TreeNode): node is ResultGroup {
  return "findings" in node;
}

export function treeChildren(context: TreeContext, node?: TreeNode): TreeNode[] {
  if (node === undefined) {
    return rootNodes(context);
  }
  if (isFolderNode(node)) {
    return folderGroups(context, node);
  }
  return isResultGroup(node) ? node.findings : [];
}

function rootNodes(context: TreeContext): TreeNode[] {
  const { folders, results } = context;
  const state = viewState(folders, results);
  if (state === "none" || state === "unavailable") {
    return [];
  }
  if (folders.length === 1) {
    return folderGroups(context, folders[0]);
  }
  return folders.map((folder) => folderNode(folder, results.get(folder.key), context.scanning === folder.key, context.now));
}

function folderGroups(context: TreeContext, folder: FolderInfo): ResultGroup[] {
  const findings = context.results.get(folder.key)?.findings ?? [];
  return groupFindings(findings, context.groupBy, folder.root, folder.key);
}
