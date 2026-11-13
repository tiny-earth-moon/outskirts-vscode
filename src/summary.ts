export function scanSummary(count: number, folder?: string): string {
  const where = folder === undefined ? "" : ` in ${folder}`;
  if (count === 0) {
    return `outskirts: no unused code found${where}.`;
  }
  return `outskirts: ${statusText(count)}${where}.`;
}

export function sequenceSummary(counts: readonly number[]): string {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const folders = counts.length === 1 ? "1 folder" : `${String(counts.length)} folders`;
  return total === 0 ? `outskirts: no unused code found in ${folders}.` : `outskirts: ${statusText(total)} in ${folders}.`;
}

export function statusText(count: number): string {
  return count === 1 ? "1 result" : `${String(count)} results`;
}

export function statusTooltip(folders: readonly { name: string; count: number | undefined }[]): string {
  return folders
    .map((folder) => `${folder.name}: ${folder.count === undefined ? "not scanned" : statusText(folder.count)}`)
    .join("\n");
}
