const markers = ["Package.swift", ".outskirts.yml", ".periphery.yml"];
const bundleExtensions = [".xcodeproj", ".xcworkspace"];

export const markerGlob = `{${[...markers, ...bundleExtensions.map((extension) => `*${extension}`)].join(",")}}`;

export function isScannableRoot(names: readonly string[]): boolean {
  return names.some((name) => markers.includes(name) || bundleExtensions.some((extension) => name.endsWith(extension)));
}
