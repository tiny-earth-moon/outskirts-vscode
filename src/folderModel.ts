import { FolderResults, ResultsState, resultsState } from "./resultsStore";
import { statusText } from "./summary";

export interface FolderInfo {
  key: string;
  name: string;
  root: string;
}

export interface FolderNode extends FolderInfo {
  type: "folder";
  description: string;
  expanded: boolean;
  stale: boolean;
}

export type ViewState = "unavailable" | ResultsState;

export function relativeTime(elapsed: number): string {
  const minutes = Math.floor(Math.max(elapsed, 0) / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${String(minutes)} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${String(hours)} h ago` : `${String(Math.floor(hours / 24))} d ago`;
}

export function nextTimeChange(elapsed: number): number {
  const minute = 60000;
  const unit = elapsed < 60 * minute ? minute : elapsed < 24 * 60 * minute ? 60 * minute : 24 * 60 * minute;
  return unit - (Math.max(elapsed, 0) % unit);
}

export function nextDescriptionChange(results: ReadonlyMap<string, FolderResults>, now: number): number | undefined {
  const delays = [...results.values()].filter((entry) => entry.findings.length > 0).map((entry) => nextTimeChange(now - entry.scannedAt));
  return delays.length === 0 ? undefined : Math.min(...delays);
}

export function folderDescription(entry: FolderResults | undefined, scanning: boolean, now: number): string {
  if (scanning) {
    return "scanning…";
  }
  if (entry === undefined) {
    return "not scanned";
  }
  if (entry.findings.length === 0) {
    return "no unused code";
  }
  const stale = entry.stale.size === 0 ? [] : [`${String(entry.stale.size)} to rescan`];
  return [statusText(entry.findings.length), ...stale, relativeTime(now - entry.scannedAt)].join(" · ");
}

export function folderNode(
  folder: FolderInfo,
  entry: FolderResults | undefined,
  scanning: boolean,
  now: number,
): FolderNode {
  const expanded = entry !== undefined && entry.findings.length > 0;
  return { ...folder, type: "folder", description: folderDescription(entry, scanning, now), expanded, stale: (entry?.stale.size ?? 0) > 0 };
}

export function viewState(folders: readonly FolderInfo[], results: ReadonlyMap<string, FolderResults>): ViewState {
  if (folders.length === 0) {
    return "unavailable";
  }
  const states = folders.map((folder) => resultsState(results.get(folder.key)));
  if (states.every((state) => state === "none")) {
    return "none";
  }
  if (folders.length > 1) {
    return "results";
  }
  return states[0];
}
