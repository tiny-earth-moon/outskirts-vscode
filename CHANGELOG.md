# Changelog

## 0.1.0 (unreleased)

- `outskirts: Scan` runs outskirts in the workspace folder and shows its results as diagnostics.
- A message gives the number of results when the scan ends, or says that nothing is unused.
- `outskirts: Clear Results` removes them.
- Settings `outskirts.path`, `outskirts.arguments`, `outskirts.skipBuild` and `outskirts.severity`.
- An outskirts view in the activity bar lists the results grouped by file or by kind, with buttons to scan, cancel, clear, regroup and open the settings.
- `outskirts: Scan Options…` toggles reusing the index, sets the severity and edits the extra arguments.
- `outskirts: Cancel Scan` stops a running scan; a second scan is refused while one runs.
- A status bar item shows the number of results and opens the view.
- In a multi-root workspace, each scannable folder keeps its own results, with a node per folder in the side bar, buttons to scan or clear one folder, and an "All folders" choice that scans them in turn.
- Results show the declaration name first, then the kind of finding and the line.
