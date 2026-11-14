import { Finding } from "./findings";
import { isErrorNode, isFolderNode, isMessageNode, isResultGroup, TreeNode } from "./folderTree";
import { FolderResults } from "./resultsStore";

export interface FixScope {
  project: string;
  findings: readonly Finding[];
}

export function nodeScope(node: TreeNode, results: ReadonlyMap<string, FolderResults>): FixScope | undefined {
  if (isFolderNode(node)) {
    return { project: node.key, findings: results.get(node.key)?.findings ?? [] };
  }
  if (isMessageNode(node) || isErrorNode(node)) {
    return undefined;
  }
  if (isResultGroup(node)) {
    return node.folder === undefined ? undefined : { project: node.folder, findings: node.findings };
  }
  for (const [project, entry] of results) {
    if (entry.findings.includes(node)) {
      return { project, findings: [node] };
    }
  }
  return undefined;
}

export function projectsWithResults(keys: readonly string[], results: ReadonlyMap<string, FolderResults>): string[] {
  return keys.filter((key) => (results.get(key)?.findings.length ?? 0) > 0);
}
