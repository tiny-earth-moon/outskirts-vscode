/** Creates a view that may be missing from the manifest VS Code read at startup, as after an update without a reload. */
export function createOptionalView<T>(create: () => T, report: (error: unknown) => void): T | undefined {
  try {
    return create();
  } catch (error) {
    report(error);
    return undefined;
  }
}
