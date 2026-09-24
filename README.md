# Fragments

Fragments is an Obsidian backed snippet app. It opens in a reusable app window on desktop and a tab on mobile. Each fragment is an ordinary Markdown note under a vault folder. YAML frontmatter stores `tags`, `starred`, `language`, and optional `title`; the Markdown body is the fragment. The files remain editable in Obsidian or any text editor.

## Use

Install the plugin in `<vault>/.obsidian/plugins/fragments`, enable it under Community plugins, and run **Fragments: Open** or click the ribbon icon. Open **Obsidian Settings → Community plugins → Fragments** to choose the library folder and the font used for snippet editing and preview. The folder field suggests existing vault folders as you type. The default folder is `Fragments`; its subfolders become collections.

The app supports search across titles, tags, collections, and note bodies; Starred and Recent views; collection and tag filtering; Markdown editing and preview; copy; rename; move; and trash. Use Ctrl+K (⌘K on macOS) for the command palette and Ctrl+S (⌘S on macOS) to save. Edits also save after a short pause. Fragments reads changes made to the Markdown files outside the app and avoids overwriting a note changed while a draft was open.

## Install with BRAT

Once this repository is hosted on GitHub and its first release is published, install and enable [BRAT](https://github.com/TfTHacker/obsidian42-brat) in Obsidian. Run **BRAT: Add a beta plugin for testing** and enter the repository's GitHub URL. BRAT installs the release and updates Fragments when a new release appears.

Each release attaches `manifest.json`, `main.js`, and `styles.css` as separate assets. For a manual install, place those three files in `<vault>/.obsidian/plugins/fragments/`, reload Obsidian, and enable Fragments under Community plugins.

## Releases

Push Conventional Commits to `main` to publish automatically. `fix:` creates a patch release, `feat:` creates a minor release, and a breaking change creates a major release. The release workflow checks the project, keeps the versions in `package.json`, `manifest.json`, and `versions.json` aligned, builds `main.js`, writes `CHANGELOG.md`, and publishes the three Obsidian assets. A repository administrator must allow GitHub Actions to write contents.

After a GitHub remote and `main` branch are available, run `pnpm run release:dry-run` to inspect the next release without publishing.

## Development

```bash
pnpm install
pnpm run dev
pnpm run check
```

The build produces `main.js` in the repository root. The plugin requires `manifest.json`, `main.js`, and `styles.css`. The local workbench vault is `../test-vault` and its plugin directory is symlinked to this repository at `../test-vault/.obsidian/plugins/fragments`. Open that vault in Obsidian and enable Fragments. Changes to `main.js` or `styles.css` can be reloaded with Hot Reload if installed; reload Obsidian after changing the manifest.

For isolated checks in a real Obsidian process, follow [the local testing guide](docs/local-testing.md).

No note content leaves the vault. Fragments has no telemetry or network calls.
