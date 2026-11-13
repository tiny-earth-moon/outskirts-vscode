# outskirts for VS Code

Shows the unused Swift code found by [outskirts](https://github.com/tiny-earth-moon/outskirts) as diagnostics in the editor and the Problems panel.

The extension does not analyze Swift itself: it runs the installed `outskirts` executable with `scan --format json --quiet` in the workspace folder and shows each result at its location.

## Requirements

outskirts installed, e.g. `brew install tiny-earth-moon/tap/outskirts`, and a project it can scan (a Swift package or an Xcode project, configured with `.outskirts.yml` if needed).

## Commands

- **outskirts: Scan** scans the folder of the active editor (or the folder you pick in a multi-root workspace) and replaces the previous results. The scan can be cancelled from its notification; when it ends, a message gives the number of results.
- **outskirts: Clear Results** removes the results.

The output of outskirts is written to the "outskirts" output channel.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `outskirts.path` | `outskirts` | Path of the executable, or its name on the PATH. |
| `outskirts.arguments` | `[]` | Extra arguments for `outskirts scan`, e.g. `["--schemes", "App"]`. |
| `outskirts.severity` | `warning` | `error`, `warning`, `information` or `hint`. |

A scan builds the project, so it only runs in a trusted workspace, and `outskirts.path` is read from user or machine settings only, never from a workspace.

## Known limits

- A scan builds the project, so it is started by hand, not on save.
- macOS first: scanning Xcode projects requires macOS; Swift packages can also be scanned where outskirts runs on Linux.
