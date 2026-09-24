# Test Fragments locally in Obsidian

Use a disposable vault and a separate Obsidian profile for UI checks. Keep the user's ordinary Obsidian process and vaults running. Reuse one test session while iterating; record its temporary directory, profile path, process ID, and debugging port.

## Fixture

Build with `pnpm run build`, then create a temporary root and a vault with `.obsidian/plugins/fragments`. Copy `main.js`, `manifest.json`, and `styles.css` there. Put a few ordinary `.md` files in the vault's `Fragments` folder, including a subfolder for a collection. Set `.obsidian/community-plugins.json` to `["fragments"]` and `.obsidian/app.json` to `{"safeMode":false}`. Create a separate profile with an `obsidian.json` vault entry pointing to the disposable vault.

On this machine, `electron43 /usr/lib/obsidian/app.asar --user-data-dir=<profile> --remote-debugging-address=127.0.0.1 --remote-debugging-port=<unused-port> --disable-gpu --no-first-run` launches the isolated profile. Check the installed Obsidian launcher before using those paths elsewhere. Confirm the connected vault path before enabling the plugin or mutating notes.

Native computer controls are preferred when available. If unavailable, use the local Chrome DevTools Protocol endpoint for the isolated process. Select the main `app://obsidian.md/index.html` target to enable the plugin and call its Open command, then select the Fragments popout target for pointer and keyboard interactions and screenshots. Rediscover target IDs after a plugin reload or window close.

## Checks

1. Open Fragments repeatedly. One app window should remain. Reopen after replacing its tab with a Markdown note and after a plugin reload.
2. Create a fragment in the UI, edit its body, rename it, add tags, star it, move it into a collection, and preview it. Read the saved `.md` file and confirm it has valid YAML frontmatter and ordinary Markdown content.
3. Search by title, tag, and body text. Check Starred, Recent, collection filtering, the command palette, copying, and keyboard shortcuts.
4. Modify a file outside Fragments and confirm the UI refreshes. While editing a draft, modify the file externally and confirm Fragments reports a conflict instead of overwriting it.
5. Add a large set of notes to the disposable vault. Check that browsing and search remain responsive and the list only renders visible rows.
6. Open Obsidian Settings → Community plugins → Fragments. Type part of an existing folder name, select its suggestion, and confirm the Fragments window indexes that folder. Change the snippet font, including a custom installed font, and confirm both the editor and Markdown preview update.
7. Inspect desktop and narrow window layouts, focus visibility, empty states, and console errors.

For another build, copy the same three artifacts into the same fixture and disable then enable Fragments. Do not launch a new profile just to load a build. At the end, close only the isolated process and remove its disposable directory. Keep any requested screenshots.
