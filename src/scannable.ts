const markers = new Set(["Package.swift", ".outskirts.yml", ".periphery.yml"]);

export function isScannableRoot(names: readonly string[]): boolean {
  return names.some((name) => markers.has(name) || name.endsWith(".xcodeproj") || name.endsWith(".xcworkspace"));
}
