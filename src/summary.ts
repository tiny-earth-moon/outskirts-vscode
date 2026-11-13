export function scanSummary(count: number, folder: string): string {
  return count === 0 ? `No unused code found in ${folder}.` : `${statusText(count)} in ${folder}.`;
}

export function sequenceSummary(counts: readonly number[]): string {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const folders = counts.length === 1 ? "1 folder" : `${String(counts.length)} folders`;
  return total === 0 ? `No unused code found in ${folders}.` : `${statusText(total)} in ${folders}.`;
}

export function statusText(count: number): string {
  return count === 1 ? "1 result" : `${String(count)} results`;
}

export function statusTooltip(folders: readonly { name: string; count: number | undefined; stale?: number }[]): string {
  return folders
    .map((folder) => {
      const count = folder.count === undefined ? "not scanned" : statusText(folder.count);
      const stale = (folder.stale ?? 0) > 0 ? ` · ${String(folder.stale)} to rescan` : "";
      return `${folder.name}: ${count}${stale}`;
    })
    .join("\n");
}
