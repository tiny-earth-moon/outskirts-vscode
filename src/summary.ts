export function scanSummary(count: number): string {
  if (count === 0) {
    return "outskirts: no unused code found.";
  }
  return count === 1 ? "outskirts: 1 result." : `outskirts: ${String(count)} results.`;
}
