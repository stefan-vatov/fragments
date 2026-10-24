# Fragments agent notes

- Plugin ID: `fragments`. Source: `src/`. Build output: `main.js`.
- The shared `../test-vault` is a development workbench, not disposable.

## Local Obsidian testing

Read [docs/local-testing.md](docs/local-testing.md) before launching Obsidian for
local testing, UI testing, or computer use testing.

Run automated Linux tests headlessly with Electron's Ozone headless backend and
all X11/Wayland display connections unset. Never create visible test windows
unless the user explicitly requests them. Never fall back to the user's desktop.
Use an isolated vault and profile, and build with
`FRAGMENTS_BUILD_OUTFILE="$FRAGMENTS_TEST_ROOT/build/main.js"` to avoid hot-reloading
a plugin linked into the user's running vault. This also applies to `pnpm run check`.
Reuse the recorded test session while iterating; copy updated artifacts and reload
the plugin in that session. Verify real pointer/keyboard interactions, Markdown
writes, app-window identity through replacement/reload, and zero test-process
desktop clients. Report the backend, interaction tool, actual coverage, and cleanup.
Leave the user's normal Obsidian process and vaults untouched.
