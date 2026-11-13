# outskirts for VS Code

Shows the unused Swift code found by [outskirts](https://github.com/tiny-earth-moon/outskirts) as diagnostics in the editor and the Problems panel.

The extension does not analyze Swift itself: it runs the installed `outskirts` executable with `scan --format json --quiet` in the workspace folder and shows each result at its location.

## Requirements

outskirts installed, e.g. `brew install tiny-earth-moon/tap/outskirts`, and a project it can scan (a Swift package or an Xcode project, configured with `.outskirts.yml` if needed).

## Commands

- **outskirts: Scan** scans the folder of the active editor (or the folder you pick in a multi-root workspace) and replaces the previous results. The scan can be cancelled from its notification; when it ends, a message gives the number of results.
- **outskirts: Cancel Scan** stops the running scan. Only one scan runs at a time.
- **outskirts: Clear Results** removes the results.
- **outskirts: Scan Options…** toggles reusing the existing index, sets the severity and edits the extra arguments of the workspace folder. Arguments are quoted like in a shell, but no shell is used.
- **outskirts: Group by File** / **Group by Kind** change how the side bar groups the results.
- **outskirts: Open Settings** shows the settings of the extension.

The output of outskirts is written to the "outskirts" output channel.

## Side bar

The outskirts icon in the activity bar opens the results, grouped by file or by kind of finding with their counts; clicking a result opens its location. The title bar of the view has buttons to scan, cancel, change the options, switch the grouping, clear the results and open the settings. After a scan, the status bar shows the number of results; clicking it shows the view.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `outskirts.path` | `outskirts` | Path of the executable, or its name on the PATH. |
| `outskirts.arguments` | `[]` | Extra arguments for `outskirts scan`, e.g. `["--schemes", "App"]`. |
| `outskirts.skipBuild` | `false` | Reuse the existing index instead of building the project (`--skip-build`). |
| `outskirts.severity` | `warning` | `error`, `warning`, `information` or `hint`. |

A scan builds the project, so it only runs in a trusted workspace, and `outskirts.path` is read from user or machine settings only, never from a workspace.

## Known limits

- A scan builds the project, so it is started by hand, not on save.
- macOS first: scanning Xcode projects requires macOS; Swift packages can also be scanned where outskirts runs on Linux.
