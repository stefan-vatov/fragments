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
- This repository, installed dependencies, Python 3, curl, and the pnpm version
  declared in `package.json`. Run commands from the repository root.
- Node with built-in `fetch` and `WebSocket` for CDP:
  `node -p '[process.version, typeof fetch, typeof WebSocket].join(" ")'` must
  show two `function` values. Activate the installed Node/pnpm runtime if needed.
- The local Chrome DevTools Protocol (CDP) connection described below. It drives
  the actual Electron renderer through pointer/key input and captures screenshots
  on both platforms. Native computer use is optional for explicitly requested
  visible sessions.

The default Linux backend is Xvfb with `--ozone-platform=x11`. Ozone headless
(`--ozone-platform=headless`, with inherited display variables unset) is an
optional alternative for builds that support it. If either backend fails, stop
and inspect the log; never retry against the user's display. Report the backend
and interaction tool. Invoking a plugin method checks behavior; pointer/keyboard
input checks the rendered interaction. A unit test or successful plugin load
alone is not evidence that the UI works.

## 1. Reuse a test session or create an isolated fixture

First look for the session recorded by the current task: its temporary directory,
profile path, process ID, and debugging port. Confirm the process and vault before
reusing them. Do not launch another test instance on every iteration.

For a fresh session, build and create the fixture:

```bash
export FRAGMENTS_TEST_ROOT="$(mktemp -d /tmp/fragments-ui.XXXXXX)"
FRAGMENTS_BUILD_OUTFILE="$FRAGMENTS_TEST_ROOT/build/main.js" pnpm run build
python3 - <<'PY'
import json, os, secrets, shutil, time
from pathlib import Path

root = Path(os.environ['FRAGMENTS_TEST_ROOT']).resolve()
vault = root / 'Fragments Test'
profile = root / 'profile'
plugin = vault / '.obsidian/plugins/fragments'
plugin.mkdir(parents=True)
profile.mkdir()
(vault / 'Fragments/Examples').mkdir(parents=True)
(vault / 'Fragments/Welcome.md').write_text(
    '---\ntitle: Welcome\ntags: [testing]\nstarred: false\nlanguage: markdown\n---\n\n'
    '# Headless fixture\n\nA synthetic fragment for testing.\n')
(vault / 'Fragments/Examples/Desk.md').write_text(
    '---\ntitle: Desk\ntags: [studio]\nstarred: true\nlanguage: plaintext\n---\n\n'
    'Arrange the desk.\n')
(vault / '.obsidian/community-plugins.json').write_text('["fragments"]')
(vault / '.obsidian/app.json').write_text('{"safeMode":false}')
for name in ['main.js', 'manifest.json', 'styles.css']:
    source = root / 'build/main.js' if name == 'main.js' else Path.cwd() / name
    shutil.copy2(source, plugin / name)
(profile / 'obsidian.json').write_text(json.dumps({'vaults': {
    secrets.token_hex(8): {
        'path': str(vault), 'ts': int(time.time() * 1000), 'open': True
    }
}}))
print(vault)
PY
```

Expected result: a new `/tmp/fragments-ui.…/Fragments Test` vault with two fragments,
one collection, and one starred note. Only synthetic Markdown and this build are copied into
it. Its Obsidian profile is separate from the user's normal profile. The profile
JSON bootstrap is an integration with Obsidian's current desktop implementation;
if its format changes, open this fixture through Obsidian's vault chooser.

The existing `../test-vault` workbench remains an alternative for an explicitly
chosen development session; its symlink and Hot Reload setup are described in
[the README](../README.md#development). Do not assume it is disposable.
The isolated build above leaves the repository's live `main.js` untouched. Do
not run the root watcher or a default root-output build for automated UI testing
when a user's vault may have this checkout linked into its plugins.

## 2. Launch the test profile once

Inspect the installed executable and choose an unused local port. The free-port
probe does not reserve the port; check the startup log and endpoint before
connecting. Use the same fixture and port for subsequent iterations.

```bash
export FRAGMENTS_CDP_PORT="$(python3 - <<'PYPORT'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    print(sock.getsockname()[1])
PYPORT
)"
```

On Linux, set `FRAGMENTS_OBSIDIAN_EXECUTABLE` to the installed packaged binary
(for example, an extracted package's `obsidian` executable). This example keeps
`xvfb-run` alive as the display owner until its foreground child exits, allowing
session reuse and automatic display cleanup:

```bash
export FRAGMENTS_OBSIDIAN_EXECUTABLE="/absolute/path/to/obsidian"
export FRAGMENTS_DISPLAY_MODE="xvfb"
nohup env -u DISPLAY -u WAYLAND_DISPLAY -u WAYLAND_SOCKET -u XAUTHORITY \
  xvfb-run -a -s '-screen 0 1440x1000x24 -nolisten tcp' bash -c '
    test -n "$DISPLAY" || exit 1
    "$FRAGMENTS_OBSIDIAN_EXECUTABLE" --ozone-platform=x11 \
      --user-data-dir="$FRAGMENTS_TEST_ROOT/profile" \
      --remote-debugging-address=127.0.0.1 \
      --remote-debugging-port="$FRAGMENTS_CDP_PORT" \
      --disable-gpu --no-first-run &
    child=$!
    printf "%s\n" "$child" > "$FRAGMENTS_TEST_ROOT/obsidian.pid"
    wait "$child"
  ' > "$FRAGMENTS_TEST_ROOT/obsidian.log" 2>&1 &
export FRAGMENTS_DISPLAY_OWNER_PID=$!
```

If the distribution requires `electron43 /usr/lib/obsidian/app.asar`, replace the
quoted executable invocation above with those inspected paths, keeping the
isolation and debugging flags. Do not run a launcher that delegates to the
user's existing profile. Confirm the test process's environment points only to
the test-owned display. On a Linux desktop, inspect only recorded test PIDs in
its compositor client list (for example, `hyprctl clients -j` on Hyprland) and
confirm zero test clients on the user's desktop after launch, activation, and
reload. Xvfb windows exist only inside its isolated display.

On macOS, run the following only inside the dedicated GUI test environment, or
when the user explicitly requested visible testing in their session. Invoke the
bundle executable directly with the isolated profile; do not use `open`, which
can delegate to an existing Obsidian instance:

```bash
export FRAGMENTS_OBSIDIAN_EXECUTABLE="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
export FRAGMENTS_DISPLAY_MODE="dedicated-gui"
nohup "$FRAGMENTS_OBSIDIAN_EXECUTABLE" \
  --user-data-dir="$FRAGMENTS_TEST_ROOT/profile" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$FRAGMENTS_CDP_PORT" \
  --no-first-run > "$FRAGMENTS_TEST_ROOT/obsidian.log" 2>&1 &
printf '%s\n' "$!" > "$FRAGMENTS_TEST_ROOT/obsidian.pid"
```

After the PID file appears, record the session:

```bash
export FRAGMENTS_OBSIDIAN_PID="$(cat "$FRAGMENTS_TEST_ROOT/obsidian.pid")"
python3 - <<'PYSESSION'
import json, os
from pathlib import Path
keys = ['FRAGMENTS_TEST_ROOT', 'FRAGMENTS_CDP_PORT', 'FRAGMENTS_OBSIDIAN_PID',
        'FRAGMENTS_DISPLAY_MODE', 'FRAGMENTS_DISPLAY_OWNER_PID']
root = Path(os.environ['FRAGMENTS_TEST_ROOT'])
(root / 'session.json').write_text(json.dumps(
    {k: os.environ[k] for k in keys if k in os.environ}, indent=2))
print(root / 'session.json')
PYSESSION
```

Expected result: the fixture vault opens in the isolated environment and the log
reports a DevTools WebSocket on the selected port. Record `session.json`'s path
in the task's working record. Inspect the process, profile, and vault before
restoring its variables in a new shell. Leave the user's existing Obsidian
process and vaults running.

CDP checks cover rendered input, vault writes, and Obsidian popout identity.
Linux Xvfb does not establish behavior under the user's native compositor,
desktop scaling, or OS-window chrome. macOS checks establish native behavior only
in the tested GUI environment. Report those limits explicitly.

Once startup finishes, list the targets:

```bash
curl --fail --silent "http://127.0.0.1:$FRAGMENTS_CDP_PORT/json/list"
```

Expect a page at `app://obsidian.md/index.html`. Popouts appear as separate page
targets, often with an `about:blank` URL. Rediscover their IDs after a window
closes or the plugin reloads. Do not copy a target ID from an earlier session.

## 3. Connect and load the current build

Native computer use can enable Fragments in **Settings → Community plugins** and
run **Fragments: Open**. For CDP, create this small client in the test directory:

```bash
cat > "$FRAGMENTS_TEST_ROOT/cdp.mjs" <<'JS'
import { readFile, writeFile } from 'node:fs/promises';

const port = Number(process.env.FRAGMENTS_CDP_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Set FRAGMENTS_CDP_PORT');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const [method, argument, outputPath] = process.argv.slice(2);
if (method === 'list') {
  console.log(JSON.stringify(targets, null, 2));
} else {
  const target = process.env.FRAGMENTS_CDP_TARGET
    ? targets.find(page => page.id === process.env.FRAGMENTS_CDP_TARGET)
    : targets.find(page => page.type === 'page' && page.url.endsWith('/index.html'));
  if (!target) throw Error('Target is gone; list targets again');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const timeout = setTimeout(() => { socket.close(); process.exit(1); }, 15000);
  try {
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });
    const params = method === 'Runtime.evaluate'
      ? { expression: await readFile(argument, 'utf8'), awaitPromise: true, returnByValue: true }
      : JSON.parse(argument || '{}');
    const message = await new Promise((resolve, reject) => {
      socket.onerror = reject;
      socket.onmessage = event => {
        const response = JSON.parse(event.data);
        if (response.id === 1) resolve(response);
      };
      socket.send(JSON.stringify({ id: 1, method, params }));
    });
    if (message.error || message.result.exceptionDetails) {
      throw Error(JSON.stringify(message.error || message.result.exceptionDetails));
    }
    if (method === 'Page.captureScreenshot') {
      await writeFile(outputPath, Buffer.from(message.result.data, 'base64'));
      console.log(outputPath);
    } else {
      console.log(JSON.stringify(message.result, null, 2));
    }
  } finally {
    clearTimeout(timeout);
    socket.close();
  }
}
JS
node "$FRAGMENTS_TEST_ROOT/cdp.mjs" list
```

Check the connected vault before any mutation. Default evaluation targets the
main renderer, where Obsidian's `app` is available:

```bash
cat > "$FRAGMENTS_TEST_ROOT/inspect.js" <<'JS'
({ vault: app.vault.getName(), path: app.vault.adapter.getBasePath(),
   plugins: Object.keys(app.plugins.plugins) })
JS
unset FRAGMENTS_CDP_TARGET
node "$FRAGMENTS_TEST_ROOT/cdp.mjs" Runtime.evaluate "$FRAGMENTS_TEST_ROOT/inspect.js"
```

The returned path must equal the canonical filesystem path of
`$FRAGMENTS_TEST_ROOT/Fragments Test` (`/tmp` resolves to `/private/tmp` on macOS). The filesystem
adapter and plugin-manager calls here are desktop test-harness integrations, not
APIs to import into the shipped plugin. If they change, use the app UI.

Enable Fragments if necessary, then open it:

```bash
cat > "$FRAGMENTS_TEST_ROOT/open.js" <<'JS'
(async () => {
  if (app.vault.getName() !== 'Fragments Test') throw Error('Unexpected vault');
  await app.plugins.setEnable(true);
  await app.plugins.enablePluginAndSave('fragments');
  await app.plugins.plugins.fragments.activateView();
  return app.workspace.getLeavesOfType('fragments-view').map(leaf => ({
    title: leaf.view.getDisplayText(),
    popout: leaf.getContainer() !== app.workspace.rootSplit,
    text: leaf.view.contentEl.innerText
  }));
})()
JS
node "$FRAGMENTS_TEST_ROOT/cdp.mjs" Runtime.evaluate "$FRAGMENTS_TEST_ROOT/open.js"
```

With a fresh fixture, expect one Fragments popout containing Welcome and Desk,
an Examples collection, and the testing and studio tags.
The test profile also has an Obsidian host window; count Fragments app windows
separately from that host.

For another build in the same session, run
`FRAGMENTS_BUILD_OUTFILE="$FRAGMENTS_TEST_ROOT/build/main.js" pnpm run build`, copy that
isolated `main.js` plus the repository's `manifest.json` and `styles.css` into
the fixture plugin directory, and disable/enable Fragments through
the UI or `app.plugins.disablePlugin('fragments')` followed by
`app.plugins.enablePlugin('fragments')`. Open Fragments again. Do not restart Obsidian
or make a new profile just to load another build. A build alone does not update
the copied plugin.

## 4. Exercise the actual interface

Rediscover the popout page and set `FRAGMENTS_CDP_TARGET` to its returned ID for
DOM inspection, input, and screenshots. Keep that variable unset when using
`app` in the main renderer. Observe current labels and element geometry before
sending input; do not reuse coordinates from another window size.

For CDP interactions, use `Runtime.evaluate` to obtain an element's
`getBoundingClientRect()`, then send `Input.dispatchMouseEvent` with
`mousePressed`/`mouseReleased`, the observed `x`/`y`, `button: "left"`, and
`clickCount: 1`. Use `Input.insertText` for typing and `Input.dispatchKeyEvent`
for keys. Use the platform shortcut modifier: Control on Linux, Meta/Command on
macOS (CDP modifier bit 2 versus 4). For example, with the search field focused in the selected popout:

```bash
node "$FRAGMENTS_TEST_ROOT/cdp.mjs" Input.insertText '{"text":"Arrange"}'
node "$FRAGMENTS_TEST_ROOT/cdp.mjs" Input.dispatchKeyEvent \
  '{"type":"keyDown","key":"Escape","code":"Escape","windowsVirtualKeyCode":27}'
node "$FRAGMENTS_TEST_ROOT/cdp.mjs" Page.captureScreenshot '{}' \
  "$FRAGMENTS_TEST_ROOT/fragments.png"
```

Inspect the screenshot. Run interactions relevant to the change:

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
   the button, verify the folders on disk, and confirm Escape and the close
   button cancel without creating a folder. Check command-palette typing and
   cancellation too, since it shares the modal overlay.

Wait for expected DOM or file state with a bounded timeout. API setup does not
replace pointer/keyboard coverage. Record the flows actually exercised; the
checklist alone is not evidence of coverage.

For the rename and dialog regressions, with the isolated fixture and Fragments popout open,
run `node scripts/test-rename-headless.mjs` with `FRAGMENTS_TEST_ROOT` and
`FRAGMENTS_CDP_PORT` set for that session. It creates and removes a synthetic
collection, drives the real interface, and checks the resulting Markdown files.
It also delays a real file creation to verify that immediate typing cannot rename
the previous fragment, then checks that the new title receives focus and selects
its text when creation finishes.
The same script holds body reads and saves to check renaming before a new body
loads, completing a previous note's save after editing a new note, and typing more
body text while a rename waits for a save. It checks the persisted Markdown in
each case. Unit tests also cover returning to a note before its queued save ends.

## 5. Verify app-window reuse through replacement and reload

A leaf count alone missed this bug. Preserve the actual window identity in one
main-renderer evaluation while replacing its view and reloading the plugin:

```bash
cat > "$FRAGMENTS_TEST_ROOT/reuse-window.js" <<'JS'
(async () => {
  if (app.vault.getName() !== 'Fragments Test') throw Error('Unexpected vault');
  const leaf = await app.plugins.plugins.fragments.activateView();
  const originalWindow = leaf.getContainer();
  const note = app.vault.getAbstractFileByPath('Fragments/Welcome.md');
  if (!note) throw Error('Missing fixture');
  await leaf.openFile(note);
  const reopened = await app.plugins.plugins.fragments.activateView();
  if (reopened.getContainer() !== originalWindow) throw Error('View replacement created another window');
  app.workspace.setActiveLeaf(reopened);
  const sibling = app.workspace.getLeaf('tab');
  await sibling.openFile(note);
  if (sibling.getContainer() !== originalWindow) throw Error('Wrong test window');
  await app.plugins.disablePlugin('fragments');
  await app.plugins.enablePlugin('fragments');
  const restored = await app.plugins.plugins.fragments.activateView();
  if (restored.getContainer() !== originalWindow) throw Error('Reload created another window');
  const windows = new Set();
  app.workspace.iterateAllLeaves(candidate => {
    if (candidate.getContainer() !== app.workspace.rootSplit) windows.add(candidate.getContainer());
  });
  if (windows.size !== 1 || app.workspace.getLeavesOfType('fragments-view').length !== 1) {
    throw Error('Unexpected extra test windows or Fragments views');
  }
  return { reusedOriginalWindow: true, popouts: windows.size };
})()
JS
unset FRAGMENTS_CDP_TARGET
node "$FRAGMENTS_TEST_ROOT/cdp.mjs" Runtime.evaluate "$FRAGMENTS_TEST_ROOT/reuse-window.js"
```

Expected result: `reusedOriginalWindow: true` and `popouts: 1`. Take each identity
comparison before detaching that leaf; a detached leaf no longer identifies its
former window. For a UI-only run, identify the same OS window before and after.

## 6. Finish without leaving window sprawl

For isolated runs, distinguish Obsidian's logical popouts from desktop clients:
one logical Fragments app window is expected while testing, and zero test-process
windows may appear on the user's desktop.

Inspect the test process's windows. On this Linux desktop, `hyprctl clients -j`
can identify them by PID and vault title. Inspect only the known test process.
Close any note popout accidentally left by testing. Confirm one Fragments window
remains if leaving a session available for the user, and report the retained
vault/profile path. A manually closed leftover is cleanup, not a passing reuse
test; step 5 must still pass.

If the test session is no longer needed, close its fixture vault through Obsidian
and verify that the recorded test process exited before removing its temporary
directory. On Linux also verify the recorded display owner exited and its Xvfb
server was cleaned up; keep `xvfb-run` alive until Obsidian exits so its cleanup
trap can run. Terminate only recorded test processes if graceful closure fails. Never use a broad `pkill obsidian`, restart the user's normal profile,
or remove the shared `../test-vault` as cleanup. Preserve requested screenshots
and results before deleting temporary files.

## One-shot runner and CI

For a fresh fixture prepared in step 1, `scripts/run-e2e.mjs` launches the isolated
Obsidian profile, opens Fragments, drives CDP regression checks, captures
screenshots, and closes its Obsidian process. It requires `FRAGMENTS_TEST_ROOT`,
`FRAGMENTS_CDP_PORT`, and `FRAGMENTS_OBSIDIAN_EXECUTABLE`. Use it instead of the
manual launch when session reuse is unnecessary; do not run it against an
already running fixture profile.

On Linux, wrap the entire runner in its own Xvfb lifetime:

```bash
env -u DISPLAY -u WAYLAND_DISPLAY -u WAYLAND_SOCKET -u XAUTHORITY \
  xvfb-run -a -s '-screen 0 1440x1000x24 -nolisten tcp' \
  env FRAGMENTS_DISPLAY_MODE=xvfb node scripts/run-e2e.mjs
```

Here the mode is set inside the test-owned display wrapper. Keep the `DISPLAY`
and `XAUTHORITY` supplied by `xvfb-run`; clearing them afterward would disconnect
Obsidian from that isolated display. The runner rejects a missing Linux display
or mode marker. The marker records the caller's isolation responsibility; it is
not proof that an arbitrary existing display is test-owned.

On macOS, inside the dedicated GUI test runner or login session:

```bash
FRAGMENTS_DISPLAY_MODE=dedicated-gui node scripts/run-e2e.mjs
```

The marker confirms that the caller has selected the dedicated GUI environment;
it does not create a separate login session. The CI matrix uses Linux Xvfb and
native macOS Obsidian on separate runners with disposable fixtures. Report actual
CI results separately from local coverage; an unexecuted matrix is not evidence
of a platform passing. Keep logs and screenshots as artifacts before removing
the fixture. No CI job should require the user's workbench or desktop.

## Troubleshooting

| Symptom                                       | Action                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Native computer use reports disabled surfaces | State the limitation and use the local CDP fallback. Do not claim the native tool ran.                                      |
| No debugging endpoint                         | Inspect `obsidian.log`, the recorded process/profile, and port availability. Do not attach to an unrelated endpoint.        |
| Fragments is absent from the plugin list      | Confirm the copied `manifest.json` ID and folder are `fragments`, then enable community plugins in the fixture profile.     |
| The UI still shows an earlier build           | Rebuild, copy all three artifacts, then disable/enable the plugin in this same profile.                                     |
| CDP returned `exceptionDetails`               | Treat the evaluation as failed even if the protocol request itself succeeded.                                               |
| A fixture note window lingers                 | Run the window-identity regression. Fix reuse before cleaning up the leftover; do not explain it away as a second instance. |

## Verify it works

Report the tested build, fixture path, interaction tool, exercised flows, observed
window count/identity, Markdown result, and any remaining limitation. Link the
screenshot or evidence files when useful. Confirm test leftovers are closed or
explicitly retained, and keep the user's normal vaults untouched.

Run the repository's appropriate automated checks as well. Use
`FRAGMENTS_BUILD_OUTFILE="$FRAGMENTS_TEST_ROOT/build/main.js" pnpm run check` while
testing to keep its build away from a live linked plugin. The check
executes build, lint, and formatting checks in sequence. Actual desktop testing and these checks supply different evidence;
report each accurately.
