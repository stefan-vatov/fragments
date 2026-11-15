# How to test Fragments locally in Obsidian

Use a disposable vault and a separate Obsidian profile to test the current plugin
build in the real desktop app. Linux tests use a test-owned Xvfb display; macOS
tests use native Obsidian in a dedicated GUI test runner or login session. Never
silently launch on the user's active desktop. Visible testing in the user's
session requires an explicit user request. Reuse the recorded test session while
iterating. This workflow applies to local testing, UI testing, and computer use.

## Prerequisites

- Obsidian installed for the current platform. Use the packaged executable directly.
  Inspect Linux distribution launchers before using them; some invoke a separate
  Electron runtime and `app.asar`. On macOS the native executable is
  `/Applications/Obsidian.app/Contents/MacOS/Obsidian`.
- Linux: Xvfb, `xvfb-run`, and `xauth`. On Ubuntu these come from the `xvfb` and
  `xauth` packages. Clear inherited `DISPLAY`, `WAYLAND_DISPLAY`, `WAYLAND_SOCKET`,
  and `XAUTHORITY` before starting the test-owned display. Only `xvfb-run` may
  provide the new `DISPLAY` and display credentials to the test process.
- macOS: a dedicated GUI test runner or login session with WindowServer available.
  A shell-only session is insufficient for native Electron windows. A dedicated
  CI runner can provide that GUI environment; do not assume an arbitrary local
  macOS shell is isolated from the user's desktop.
- This repository, installed dependencies (`pnpm install`), Python 3, and the pnpm version
  declared in `package.json`. Run commands from the repository root.
- Node with built-in `fetch` and `WebSocket` for CDP:
  `node -p '[process.version, typeof fetch, typeof WebSocket].join(" ")'` must
  show two `function` values. Activate the installed Node/pnpm runtime if needed.
- `@playwright/test`, installed with the project dependencies. Playwright attaches
  to Obsidian over its local Chrome DevTools Protocol (CDP) endpoint; no Playwright
  browser download is needed. Native computer use is optional for explicitly
  requested visible sessions.

The default Linux backend is Xvfb with `--ozone-platform=x11`. Ozone headless
(`--ozone-platform=headless`, with inherited display variables unset) is an
optional alternative for builds that support it. If either backend fails, stop
and inspect the log; never retry against the user's display. Report the backend
and interaction tool (Playwright over CDP for the workflow below). Invoking a
plugin method checks behavior; pointer/keyboard input checks the rendered interaction. A unit test or successful plugin load
alone is not evidence that the UI works.

## 1. Reuse a test session or create an isolated fixture

First look for the session recorded by the current task: its temporary directory,
profile path, process ID, and debugging port. Inspect `session.json`, confirm the
recorded process and fixture vault, then restore `FRAGMENTS_TEST_ROOT` and
`FRAGMENTS_CDP_PORT` in your shell. Do not launch another instance on each iteration.

For a fresh session, build and prepare the fixture:

```bash
export FRAGMENTS_TEST_ROOT="$(mktemp -d /tmp/fragments-ui.XXXXXX)"
FRAGMENTS_BUILD_OUTFILE="$FRAGMENTS_TEST_ROOT/build/main.js" pnpm run build
node scripts/prepare-e2e-fixture.mjs
```

Expected result: a new `/tmp/fragments-ui.…/Fragments Test` vault with synthetic
Welcome and Desk fragments, an Examples collection, and a separate `profile`
directory. Preparation refuses an existing vault/profile; do not run it again to
update a running session. Its profile JSON bootstrap uses Obsidian's desktop
implementation; if the format changes, open this fixture through the vault chooser.

The existing `../test-vault` workbench remains an alternative for an explicitly
chosen development session; its symlink and Hot Reload setup are described in
[the README](../README.md#development). It is not disposable. Automated tests use
the isolated fixture. The build above leaves the repository's live `main.js`
untouched. Do not use a root-output build or watcher for automated testing when a
user's vault may have this checkout linked into its plugins.

## 2. Launch a reusable test session

Choose an unused local port and set the inspected, packaged Obsidian executable.
Do not use a launcher that delegates to the user's existing profile. The port
probe does not reserve its result; the runner refuses an occupied port before
launching.

```bash
export FRAGMENTS_CDP_PORT="$(python3 - <<'PYPORT'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    print(sock.getsockname()[1])
PYPORT
)"
```

On Linux, launch the runner inside a test-owned Xvfb display:

```bash
export FRAGMENTS_OBSIDIAN_EXECUTABLE="/absolute/path/to/obsidian"
env -u DISPLAY -u WAYLAND_DISPLAY -u WAYLAND_SOCKET -u XAUTHORITY \
  xvfb-run -a -s '-screen 0 1440x1000x24 -nolisten tcp' \
  env FRAGMENTS_DISPLAY_MODE=xvfb node scripts/run-e2e.mjs --serve
```

Keep this terminal running. The runner starts Electron with
`--ozone-platform=x11`, the isolated profile, and the debugging endpoint. Keep the
`DISPLAY` and `XAUTHORITY` supplied by `xvfb-run`; clearing them inside the wrapper
would disconnect Obsidian from its isolated display. The `xvfb` marker records
the caller's isolation responsibility; it does not prove that an arbitrary
existing display is test-owned.

On macOS, run inside the dedicated GUI test runner or login session:

```bash
export FRAGMENTS_OBSIDIAN_EXECUTABLE="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
FRAGMENTS_DISPLAY_MODE=dedicated-gui node scripts/run-e2e.mjs --serve
```

The macOS marker does not create a separate login session. Visible testing in the
user's session requires an explicit request. Do not use `open`, which can delegate
to an existing Obsidian instance.

Expected result: Fragments opens and the runner prints `Exploratory session ready`
with the endpoint and `$FRAGMENTS_TEST_ROOT/session.json`. Record that path. The
file contains the fixture root, port, Obsidian PID, display mode, and Linux display.
`--serve` keeps the session available until Ctrl+C and does not run scenarios.
Use another terminal from the repository root, with the recorded
`FRAGMENTS_TEST_ROOT` and `FRAGMENTS_CDP_PORT`, for the commands below.

On Linux, confirm the recorded process uses only the test-owned display. Inspect
only recorded test PIDs in the user's compositor client list (for example,
`hyprctl clients -j` on Hyprland) and confirm zero test clients after launch,
activation, and reload. Xvfb windows exist only in its isolated display.

Linux Xvfb checks do not establish behavior under the user's native compositor,
desktop scaling, or OS-window chrome. macOS checks establish native behavior only
in the tested GUI environment. Report those limits explicitly.

## 3. Attach Playwright and load updated builds

The shared [attachment helper](../scripts/obsidian-playwright.mjs) checks the test
root and verifies the connected vault's canonical filesystem path before exposing
it. It returns `{ browser, context, host, root, openFragments() }`; `host` is the
Obsidian main renderer and `openFragments()` returns the current Fragments page.
Run examples from the repository root so their imports resolve:

```bash
node --input-type=module <<'JS'
import { attachObsidian } from './scripts/obsidian-playwright.mjs';
const session = await attachObsidian();
try {
  const page = await session.openFragments();
  console.log(await page.locator('.fragments-app').ariaSnapshot());
} finally {
  await session.browser.close();
}
JS
```

Expected result: an accessibility snapshot of the actual Fragments interface.
Playwright's `browser.close()` disconnects this attached client; the test-owned
Obsidian process remains running. The test profile also has an Obsidian host
window; count Fragments app windows separately from that host.

To load another build into the same session:

```bash
FRAGMENTS_BUILD_OUTFILE="$FRAGMENTS_TEST_ROOT/build/main.js" pnpm run build
node --input-type=module <<'JS'
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attachObsidian } from './scripts/obsidian-playwright.mjs';
const session = await attachObsidian();
try {
  const plugin = join(session.root, 'Fragments Test/.obsidian/plugins/fragments');
  for (const name of ['main.js', 'manifest.json', 'styles.css']) {
    const source = name === 'main.js' ? join(session.root, 'build/main.js') : name;
    await copyFile(source, join(plugin, name));
  }
  await session.host.evaluate(async () => {
    await app.plugins.disablePlugin('fragments');
    await app.plugins.enablePlugin('fragments');
  });
  await session.openFragments();
} finally {
  await session.browser.close();
}
JS
```

A build alone does not update the copied plugin. Reuse this vault/profile and
session while iterating. `openFragments()` finds the current page after a reload;
do not retain stale page handles after a window closes. The filesystem adapter
and plugin-manager calls here are desktop test-harness integrations, not shipped
plugin APIs. If they change, enable and reload through Obsidian's UI.

## 4. Exercise the actual interface

Attach the regression scenarios to the recorded, already running session:

```bash
pnpm run test:e2e
```

Tests live in `e2e/*.spec.mjs` and run serially against the actual Electron
renderer. Inspect the output to report the scenarios that passed; the checklist
below is not evidence that every flow was exercised. Every test writes
`renderer-errors.json` under `$FRAGMENTS_TEST_ROOT/playwright-results/`.
Failed tests also retain `trace.zip` and, when the page is available, `screen.png`.
The run summary is `$FRAGMENTS_TEST_ROOT/playwright-results.json`. Preserve these
before another run replaces the test output. Failure traces include actions,
snapshots, and screenshots. Capture a separate screenshot when inspecting visual
changes in a passing flow. Verify behavior through assertions, rendered input,
and persisted Markdown.

For exploration, inspect `ariaSnapshot()` and target visible controls by role or
label. Locator actions and `expect` assertions wait for actionable elements and
expected state. Use `expect.poll` for file changes instead of fixed sleeps:

```bash
node --input-type=module <<'JS'
import { expect } from '@playwright/test';
import { join } from 'node:path';
import { attachObsidian } from './scripts/obsidian-playwright.mjs';
const session = await attachObsidian();
try {
  const page = await session.openFragments();
  console.log(await page.locator('.fragments-app').ariaSnapshot());
  const search = page.getByLabel('Search fragments', { exact: true });
  await search.fill('Welcome');
  const welcome = page.getByRole('listbox', { name: 'Fragments', exact: true })
    .getByRole('option', { name: /Welcome/ });
  await expect(welcome).toBeVisible();
  await welcome.click();
  await expect(page.getByLabel('Fragment title', { exact: true })).toHaveValue('Welcome');
  await search.fill('');
  await page.screenshot({ path: join(session.root, 'exploration.png') });
} finally {
  await session.browser.close();
}
JS
```

This example uses the synthetic Welcome note; restore that fixture if a previous
scenario deliberately changed it. Use `locator.press('ControlOrMeta+s')` for the
platform save shortcut and `press('Escape')` for cancellation. Native computer
use remains available for explicitly requested visible sessions. The older
[CDP client](../scripts/cdp-client.mjs) is an optional diagnostic fallback;
Playwright locators are the default for interaction.

Exercise flows relevant to the change:

1. Open Fragments repeatedly and concurrently. One app window should remain.
2. Create a fragment through the UI, edit and save its body, rename it, add tags,
   star it, move it into Examples, and preview it. Read the saved `.md` file and
   verify valid YAML frontmatter and ordinary Markdown content.
3. Search by title, tag, and body text. Check Starred, Recent, collection
   filtering, the command palette, copying, and keyboard shortcuts.
4. Type in the scratchpad, leave it to save, and verify
   `Fragments/_fragments-scratchpad.md`. Confirm it stays out of the list.
5. Modify a fixture file externally and confirm the UI refreshes. While editing
   a draft, change its file externally and confirm a conflict prevents overwrite.
6. For performance changes, add many synthetic notes and check browsing, search,
   and visible-row rendering.
7. For settings changes, choose an existing folder suggestion and change the
   snippet font. Verify indexing, editor, and Markdown preview update.
8. Inspect desktop-sized and narrow rendered layouts, focus visibility, empty
   states, and console errors. Close Fragments and reopen it: one replacement
   app window should open.
9. Open New collection repeatedly, including after switching between the host
   window and the Fragments popout. Confirm the name field receives focus, can
   be clicked and typed into, and Tab stays within the popup. Background inputs
   must not take focus while it is open. Create collections with Enter and with
   the button, verify folders on disk, and confirm Escape and the close button
   cancel without creating a folder. Check command-palette typing and cancellation.

API setup does not replace pointer/keyboard coverage. The legacy
`node scripts/test-rename-headless.mjs` remains available for its detailed rename
race regressions with the same session environment. It holds real reads/saves and
checks persisted Markdown while creation, renaming, and body edits overlap.

## 5. Verify app-window reuse through replacement and reload

A Fragments leaf count alone missed this bug. The window-reuse Playwright
scenario compares the actual window container before and after note replacement
and plugin reload, and verifies the unrelated note survives. To inspect the
identity directly in the same recorded session:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { attachObsidian } from './scripts/obsidian-playwright.mjs';
const session = await attachObsidian();
try {
  await session.openFragments();
  const result = await session.host.evaluate(async () => {
    const leaf = await app.plugins.plugins.fragments.activateView();
    const originalWindow = leaf.getContainer();
    const note = app.vault.getAbstractFileByPath('Fragments/Examples/Desk.md');
    if (!note) throw Error('Missing fixture');
    await leaf.openFile(note);
    const reopened = await app.plugins.plugins.fragments.activateView();
    const replacementReused = reopened.getContainer() === originalWindow;
    const notePreserved = leaf.view.file?.path === note.path;
    await app.plugins.disablePlugin('fragments');
    await app.plugins.enablePlugin('fragments');
    const restored = await app.plugins.plugins.fragments.activateView();
    const reloadReused = restored.getContainer() === originalWindow;
    const windows = new Set();
    app.workspace.iterateAllLeaves(candidate => {
      if (candidate.getContainer() !== app.workspace.rootSplit) windows.add(candidate.getContainer());
    });
    return { replacementReused, notePreserved, reloadReused, popouts: windows.size,
      fragmentsLeaves: app.workspace.getLeavesOfType('fragments-view').length };
  });
  assert.deepEqual(result, { replacementReused: true, notePreserved: true,
    reloadReused: true, popouts: 1, fragmentsLeaves: 1 });
  console.log(result);
} finally {
  await session.browser.close();
}
JS
```

Expected result: all identity checks pass, the note remains open, and one logical
popout contains one Fragments view. Compare identities before detaching a leaf;
a detached leaf no longer identifies its former window. For a UI-only run,
identify the same OS window before and after. Manually closing an extra window
is cleanup, not a passing reuse test.

## 6. Finish without leaving window sprawl

Distinguish Obsidian's logical popouts from desktop clients: one logical Fragments
app window is expected while testing, and zero test-process windows may appear
on the user's desktop. Inspect only known test PIDs in the compositor client
list. Close note popouts accidentally left by testing after verifying step 5.

When finished, stop the `--serve` runner with Ctrl+C. It disconnects Playwright
and stops its owned Obsidian process; `xvfb-run` then cleans up its display.
Confirm the recorded Obsidian PID exited and the test-owned Xvfb server is gone.
Closing an attached Playwright browser alone does not stop Obsidian.

For a manually launched session, close its fixture vault and verify the recorded
process exited. Terminate only recorded test processes if graceful closure fails.
Never use a broad `pkill obsidian`, restart the user's normal profile, or remove
`../test-vault`. Preserve requested traces, screenshots, and results before
removing temporary files. If retaining a session, report its vault/profile path,
PID, port, display backend, and observed window state.

## One-shot runner and CI

For a fresh fixture prepared in step 1, omit `--serve` to launch the isolated
profile, run Playwright Test, and stop the owned Obsidian process afterward:

```bash
env -u DISPLAY -u WAYLAND_DISPLAY -u WAYLAND_SOCKET -u XAUTHORITY \
  xvfb-run -a -s '-screen 0 1440x1000x24 -nolisten tcp' \
  env FRAGMENTS_DISPLAY_MODE=xvfb node scripts/run-e2e.mjs
```

On macOS, inside the dedicated GUI session:

```bash
FRAGMENTS_DISPLAY_MODE=dedicated-gui node scripts/run-e2e.mjs
```

Both commands require `FRAGMENTS_TEST_ROOT`, `FRAGMENTS_CDP_PORT`, and
`FRAGMENTS_OBSIDIAN_EXECUTABLE`. Do not run this launcher against an already
running fixture profile; use `pnpm run test:e2e` to attach to that session.

The CI matrix uses Linux Xvfb and native macOS Obsidian on separate runners with
disposable fixtures. Report actual CI results separately from local coverage; an
unexecuted matrix is not evidence of a platform passing. Keep logs and Playwright
artifacts before removing the fixture. No CI job uses the user's workbench or desktop.

## Troubleshooting

| Symptom                                       | Action                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native computer use reports disabled surfaces | State the limitation and use Playwright over the isolated endpoint. Do not claim native coverage.                                                                               |
| No debugging endpoint                         | Inspect `obsidian.log`, `session.json`, and the recorded process/profile. Do not attach to an unrelated endpoint.                                                               |
| Attachment rejects the vault path             | Check the recorded root and port. The endpoint must serve that root's `Fragments Test` vault.                                                                                   |
| Fragments is absent from the plugin list      | Confirm the copied manifest ID and plugin folder are `fragments`, then enable community plugins in the fixture.                                                                 |
| The UI shows an earlier build                 | Rebuild, copy all three artifacts, and reload in the same session as shown in step 3.                                                                                           |
| A locator times out                           | Read the accessibility snapshot and trace. Check the rendered role/name and expected state before changing the locator.                                                         |
| A shortcut does not reach the renderer        | Inspect key events; Obsidian/Electron can intercept shortcuts before plugin handlers. Use visible controls or save-on-blur, verify files, and report the shortcut coverage gap. |
| A fixture note window lingers                 | Run the window-identity regression and fix reuse before cleanup.                                                                                                                |

## Verify it works

Report the tested build, fixture path, backend, interaction tool, scenarios
actually exercised, observed window count/identity, Markdown result, and remaining
limits. Link traces or screenshots where useful. Confirm test leftovers are
closed or explicitly retained and the user's normal vaults remain untouched.

Run the repository's automated checks as well:

```bash
FRAGMENTS_BUILD_OUTFILE="$FRAGMENTS_TEST_ROOT/build/main.js" pnpm run check
```

This runs build, lint, formatting, and unit tests without writing a bundle into
a live linked plugin. Desktop testing and these checks provide different evidence;
report each accurately.
