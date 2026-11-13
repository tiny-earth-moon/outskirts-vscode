export function scanSummary(count: number): string {
  if (count === 0) {
    return "outskirts: no unused code found.";
  }
  return count === 1 ? "outskirts: 1 result." : `outskirts: ${String(count)} results.`;
}

export function statusText(count: number): string {
  return count === 1 ? "1 result" : `${String(count)} results`;
}
