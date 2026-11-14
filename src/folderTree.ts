import { Finding } from "./findings";
import { FolderInfo, FolderNode, folderNode, viewState } from "./folderModel";
import { FolderResults } from "./resultsStore";
import { filterFindings, isActive, ResultsFilter } from "./resultsFilter";
import { GroupBy, groupFindings, ResultGroup } from "./treeModel";
import { ScanError } from "./scanError";

export interface MessageNode {
  notice: string;
}

export interface ErrorNode {
  key: string;
  scanError: ScanError;
}

export type TreeNode = FolderNode | ResultGroup | Finding | MessageNode | ErrorNode;

export interface TreeContext {
  folders: readonly FolderInfo[];
  results: ReadonlyMap<string, FolderResults>;
  groupBy: GroupBy;
  scanning: string | undefined;
  now: number;
  filter?: ResultsFilter;
  errors?: ReadonlyMap<string, ScanError>;
}

export function isFolderNode(node: TreeNode): node is FolderNode {
  return "type" in node;
}

export function isMessageNode(node: TreeNode): node is MessageNode {
  return "notice" in node;
}

export function isErrorNode(node: TreeNode): node is ErrorNode {
  return "scanError" in node;
}

export const noMatchNotice = "No results match the filter — Clear Filter";

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
  const state = viewState(folders, results, context.errors);
  if (state === "none" || state === "unavailable") {
    return [];
  }
  const filter = context.filter;
  if (filter !== undefined && isActive(filter)) {
    const all = [...results.values()].flatMap((entry) => entry.findings);
    if (all.length > 0 && filterFindings(all, filter).length === 0) {
      return [{ notice: noMatchNotice }];
    }
  }
  if (folders.length === 1) {
    return folderGroups(context, folders[0]);
  }
  return folders.map((folder) => {
    const node = folderNode(folder, results.get(folder.key), context.scanning === folder.key, context.now);
    return context.errors?.has(folder.key) === true ? { ...node, description: "scan failed", expanded: true } : node;
  });
}

function folderGroups(context: TreeContext, folder: FolderInfo): TreeNode[] {
  const error = context.errors?.get(folder.key);
  const errors: TreeNode[] = error === undefined ? [] : [{ key: folder.key, scanError: error }];
  return [...errors, ...findingGroups(context, folder)];
}

function findingGroups(context: TreeContext, folder: FolderInfo): ResultGroup[] {
  const all = context.results.get(folder.key)?.findings ?? [];
  const findings = context.filter === undefined ? all : filterFindings(all, context.filter);
  return groupFindings(findings, context.groupBy, folder.root, folder.key);
}
