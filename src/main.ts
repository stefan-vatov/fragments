import { Effect, Result } from "effect";
import { Notice, Platform, Plugin, type WorkspaceLeaf, TFile, TFolder } from "obsidian";
import { FragmentLibrary } from "./library";
import {
  DEFAULT_SETTINGS,
  FragmentsSettingTab,
  parseStoredSettings,
  type FragmentsSettings,
} from "./settings";
import { FRAGMENTS_VIEW, FragmentsView } from "./view";

const WINDOW_MARKER = "data-fragments-app-window";

export default class FragmentsPlugin extends Plugin {
  settings: FragmentsSettings = { ...DEFAULT_SETTINGS };
  library!: FragmentLibrary;
  private activation: Promise<WorkspaceLeaf | undefined> = Promise.resolve(undefined);
  private unloaded = false;
  private settingsRevision = 0;
  private readonly settingsListeners = new Set<() => void>();

  subscribeSettings = (listener: () => void): (() => void) => {
    this.settingsListeners.add(listener);
    return () => this.settingsListeners.delete(listener);
  };

  settingsSnapshot = (): number => this.settingsRevision;

  async onload(): Promise<void> {
    // `loadData()` is `any`; parseStoredSettings decodes every field it trusts.
    const stored = (await this.loadData()) as Partial<FragmentsSettings> | null;
    this.settings = { ...this.settings, ...parseStoredSettings(stored) };
    this.library = new FragmentLibrary(this.app, this.settings);
    this.registerView(FRAGMENTS_VIEW, (leaf) => new FragmentsView(leaf, this));
    this.addSettingTab(new FragmentsSettingTab(this.app, this));
    this.addRibbonIcon("blocks", "Open Fragments", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open",
      name: "Open",
      callback: () => {
        void this.activateView();
      },
    });
    this.addCommand({
      id: "new-fragment",
      name: "New fragment",
      callback: () => {
        void this.openAndCreate();
      },
    });
    this.addCommand({
      id: "search",
      name: "Search fragments",
      callback: () => {
        void this.openSearch();
      },
    });
    this.registerObsidianProtocolHandler("fragments", async () => {
      await this.activateView();
    });
    this.app.workspace.onLayoutReady(() => {
      // Restoring the saved layout must not steal focus from the note the user
      // is opening at startup.
      if (this.app.workspace.getLeavesOfType(FRAGMENTS_VIEW).length)
        void this.activateView({ reveal: false });
    });
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) void this.library.refresh(file);
        else if (file instanceof TFolder) this.library.folderTreeChanged();
      }),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) void this.library.refresh(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.library.remove(file.path);
        // An empty folder evicts no fragment, so the sidebar needs its own signal.
        if (file instanceof TFolder) this.library.folderTreeChanged();
        else if (file.path.toLowerCase() === this.library.scratchpadPath().toLowerCase())
          this.library.scratchpadChanged();
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        // A folder rename arrives as one event with no per-descendant events,
        // so evict the whole old subtree and rebuild under the new path. The
        // moved paths must be remembered before remove() prunes the subtree.
        const moved = this.library
          .entries()
          .filter((entry) => entry.path === oldPath || entry.path.startsWith(`${oldPath}/`))
          .map((entry) => [entry.path, `${file.path}${entry.path.slice(oldPath.length)}`] as const);
        this.library.remove(oldPath);
        if (file instanceof TFile) {
          // The open draft still writes to the old path: point it at the new
          // file and persist before the list rebuild moves the selection away.
          this.library.relocate(oldPath, file.path);
          void this.flushDrafts()
            .catch(() => undefined)
            .then(() => this.library.refresh(file));
          return;
        }
        if (!(file instanceof TFolder)) return;
        // Pending drafts addressed to the old paths must land on the moved
        // files; record the moves before the reload clears them, then carry
        // them through load() so the selection follows too.
        for (const [from, to] of moved) this.library.relocate(from, to);
        const root = this.library.folder();
        if (oldPath === root || root.startsWith(`${oldPath}/`)) {
          this.settings.folder = `${file.path}${root.slice(oldPath.length)}`;
          // Reload regardless of the save result: a failed write must not leave
          // the library indexing the old path. Surface the failure and retry
          // the persistence once the reload has settled.
          let saveFailed = false;
          void this.saveSettings()
            .catch((error: Error) => {
              saveFailed = true;
              new Notice(`Fragments could not save the new folder: ${error.message}`);
            })
            .then(() => this.library.load(moved))
            .then(() => (saveFailed ? this.saveSettings() : undefined))
            .catch((error: Error) => {
              new Notice(`Fragments could not save the new folder: ${error.message}`);
            });
          return;
        }
        void this.flushDrafts()
          .catch(() => undefined)
          .then(() => this.library.load(moved));
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        void this.library.refresh(file);
      }),
    );
    void this.library.load();
  }

  onunload(): void {
    this.unloaded = true;
    this.library.cancel();
    // Queued commands cannot run once the plugin unloads: settle them so the
    // draft flush below cannot wait forever and the leaves detach promptly.
    for (const leaf of this.app.workspace.getLeavesOfType(FRAGMENTS_VIEW)) {
      if (leaf.view instanceof FragmentsView) leaf.view.abortPending();
    }
    // Detaching the leaves unmounts the editors; persist their drafts first so
    // the last <=700 ms of typing is not lost on quit or plugin reload.
    void this.flushDrafts()
      .catch(() => undefined)
      .finally(() => {
        this.app.workspace.detachLeavesOfType(FRAGMENTS_VIEW);
      });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.settingsRevision += 1;
    for (const listener of this.settingsListeners) listener();
  }

  // Flush every open editor before the library switches folders: a draft is
  // only writable while its path is still inside the current folder scope.
  async flushDrafts(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(FRAGMENTS_VIEW)) {
      if (leaf.view instanceof FragmentsView) await leaf.view.saveDraft();
    }
  }

  activateView(options: { reveal?: boolean } = {}): Promise<WorkspaceLeaf | undefined> {
    const reveal = options.reveal ?? true;
    this.activation = this.activation.catch(() => undefined).then(() => this.openView(reveal));
    return this.activation;
  }

  private async openAndCreate(): Promise<void> {
    const leaf = await this.activateView();
    if (leaf?.view instanceof FragmentsView) await leaf.view.createFragment();
  }

  private async openSearch(): Promise<void> {
    const leaf = await this.activateView();
    if (leaf?.view instanceof FragmentsView) leaf.view.openPalette();
  }

  private async openView(reveal: boolean): Promise<WorkspaceLeaf | undefined> {
    if (this.unloaded) return undefined;
    const result = await Effect.runPromise(
      Effect.result(
        Effect.tryPromise({
          try: async () => {
            const workspace = this.app.workspace;
            const leaves = workspace.getLeavesOfType(FRAGMENTS_VIEW);
            // A restored workspace keeps the leaf where the user docked it; only an
            // explicit open moves it into the app window.
            const leaf = this.prepareLeaf(leaves, !reveal);
            if (!(leaf.view instanceof FragmentsView))
              await leaf.setViewState({ type: FRAGMENTS_VIEW, active: reveal });
            if (reveal) {
              await workspace.revealLeaf(leaf);
              // Only an explicit open collapses duplicates; a restored workspace
              // keeps the leaves the user deliberately placed in several windows.
              for (const duplicate of leaves) if (duplicate !== leaf) duplicate.detach();
            }
            return leaf;
          },
          catch: (error) => error,
        }),
      ),
    );
    if (Result.isSuccess(result)) return result.success;
    new Notice("Fragments could not open.");
    return undefined;
  }

  private prepareLeaf(leaves: WorkspaceLeaf[], keepDock = false): WorkspaceLeaf {
    const workspace = this.app.workspace;
    const leaf =
      this.findWindowLeaf(!keepDock) ??
      leaves.find((item) => item.getContainer() !== workspace.rootSplit) ??
      leaves[0] ??
      workspace.getLeaf(Platform.isDesktopApp ? "window" : "tab");
    if (Platform.isDesktopApp && !keepDock && leaf.getContainer() === workspace.rootSplit)
      workspace.moveLeafToPopout(leaf);
    if (Platform.isDesktopApp && leaf.getContainer() !== workspace.rootSplit) {
      leaf.getContainer().doc.documentElement.setAttribute(WINDOW_MARKER, "true");
    }
    return leaf;
  }

  private findWindowLeaf(createTab: boolean): WorkspaceLeaf | undefined {
    if (!Platform.isDesktopApp) return undefined;
    const workspace = this.app.workspace;
    let found: WorkspaceLeaf | undefined;
    let windowLeaf: WorkspaceLeaf | undefined;
    workspace.iterateAllLeaves((leaf) => {
      const container = leaf.getContainer();
      if (
        !found &&
        container !== workspace.rootSplit &&
        container.doc.documentElement.hasAttribute(WINDOW_MARKER)
      ) {
        windowLeaf ??= leaf;
        found = workspace
          .getLeavesOfType(FRAGMENTS_VIEW)
          .find((candidate) => candidate.getContainer() === container);
      }
    });
    if (!found && windowLeaf && createTab) {
      // A note may have replaced Fragments. Keep that note and open a sibling
      // tab in the same app window; restoring a layout must not change focus.
      workspace.setActiveLeaf(windowLeaf, { focus: false });
      return workspace.getLeaf("tab");
    }
    return found;
  }
}
