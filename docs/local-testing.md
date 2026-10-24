# How to test Fragments locally in Obsidian

Use a disposable vault and a separate Obsidian profile to test the current plugin
build in the real desktop app. On Linux, run automated checks on a headless display
so test windows, activation, and reloads cannot interrupt the user's desktop.
Visible testing requires an explicit user request. Reuse that test session while iterating. This is
the workflow for requests such as “local testing”, “test the plugin in Obsidian”,
or “computer use testing”.

## Prerequisites

- Obsidian and its Electron runtime installed. The launch command below matches the
  Arch/Omarchy package layout; inspect the installed launcher before using it on
  a different machine.
- This repository, its installed dependencies, and the pnpm version declared in
  `package.json`. Run commands from the repository root.
- Python 3, curl, and Node with built-in `fetch` and `WebSocket` for the debugging
  fallback. `node -p '[process.version, typeof fetch, typeof WebSocket].join(" ")'`
  must show two `function` values. Activate the installed Node/pnpm runtime if
  the shell resolves the wrong version; do not replace working dependencies to
  compensate for an incorrect runtime.
- The local Chrome DevTools Protocol (CDP) connection described below. CDP
  controls Obsidian's actual Electron renderer, including on a headless display.
  Native computer-use controls are an option for explicitly requested visible
  sessions.

The default Linux path is CDP with Electron's Ozone headless backend. Unset both
X11 and Wayland display connections when launching it; never silently fall back
to the user's desktop if headless startup fails. The installed Electron build
must support that backend. Report the display backend and interaction tool.
Invoking a plugin method
checks behavior; pointer/keyboard input checks the rendered interaction. A unit
test or a successful plugin load alone is not evidence that the UI works.

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

root = Path(os.environ['FRAGMENTS_TEST_ROOT'])
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

Inspect the installed launcher, choose an unused local port, and launch the
isolated profile. The free-port probe does not reserve the port; check the
startup log and endpoint before connecting.

```bash
command -v obsidian
cat /usr/bin/obsidian
command -v electron43
test -f /usr/lib/obsidian/app.asar
export FRAGMENTS_CDP_PORT="$(python3 - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    print(sock.getsockname()[1])
PY
)"
export FRAGMENTS_DISPLAY_MODE="ozone-headless"
nohup env -u DISPLAY -u WAYLAND_DISPLAY -u WAYLAND_SOCKET -u XAUTHORITY \
  electron43 /usr/lib/obsidian/app.asar --ozone-platform=headless \
  --user-data-dir="$FRAGMENTS_TEST_ROOT/profile" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$FRAGMENTS_CDP_PORT" \
  --disable-gpu --no-first-run > "$FRAGMENTS_TEST_ROOT/obsidian.log" 2>&1 &
export FRAGMENTS_OBSIDIAN_PID=$!
python3 - <<'PY'
import json, os
from pathlib import Path
keys = ['FRAGMENTS_TEST_ROOT', 'FRAGMENTS_CDP_PORT', 'FRAGMENTS_OBSIDIAN_PID', 'FRAGMENTS_DISPLAY_MODE']
root = Path(os.environ['FRAGMENTS_TEST_ROOT'])
(root / 'session.json').write_text(json.dumps({k: os.environ[k] for k in keys}, indent=2))
print(root / 'session.json')
PY
```

Expected result: the `Fragments Test` vault opens internally, with no windows on the
user's desktop, and the log reports a DevTools
WebSocket on the selected port. Record `session.json`'s path in the task's working
record. Inspect the session and restore its variables when changing shells.
Leave the user's existing Obsidian process and vaults running.

On Hyprland, inspect `hyprctl clients -j` filtered to the recorded test process
and confirm it has no desktop clients after launch, Fragments activation, and
reload. Do not inspect or manipulate unrelated windows. If headless startup is
unsupported, stop this test session; use a separately isolated virtual display
or obtain an explicit request for visible testing before continuing.

Headless checks cover the actual rendered interface, input, vault writes, and
Obsidian popout identity. They do not establish native compositor focus,
workspace placement, desktop scaling, or OS-window chrome behavior. Those
specific checks require an explicitly requested visible session. See Chromium's
[headless testing guidance](https://www.chromium.org/developers/testing/running-tests/).

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

The returned path must equal `$FRAGMENTS_TEST_ROOT/Fragments Test`. The filesystem
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
for keys. For example, with the search field focused in the selected popout:

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

Wait for expected DOM or file state with a bounded timeout. API setup does not
replace pointer/keyboard coverage. Record the flows actually exercised; the
checklist alone is not evidence of coverage.

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

For headless runs, distinguish Obsidian's logical popouts from desktop clients:
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
directory. Never use a broad `pkill obsidian`, restart the user's normal profile,
or remove the shared `../test-vault` as cleanup. Preserve requested screenshots
and results before deleting temporary files.

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
