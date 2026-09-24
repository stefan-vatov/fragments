import { Notice, Platform, Plugin, type WorkspaceLeaf, TFile } from "obsidian";
import { FragmentLibrary } from "./library";
import { DEFAULT_SETTINGS, type FragmentsSettings } from "./settings";
import { FRAGMENTS_VIEW, FragmentsView } from "./view";

const WINDOW_MARKER = "data-fragments-app-window";

export default class FragmentsPlugin extends Plugin {
  settings: FragmentsSettings = { ...DEFAULT_SETTINGS };
  library!: FragmentLibrary;
  private activation: Promise<WorkspaceLeaf | undefined> = Promise.resolve(undefined);
  private unloaded = false;

  async onload(): Promise<void> {
    this.settings = {
      ...this.settings,
      ...((await this.loadData()) as Partial<FragmentsSettings> | null),
    };
    this.library = new FragmentLibrary(this.app, this.settings);
    this.registerView(FRAGMENTS_VIEW, (leaf) => new FragmentsView(leaf, this));
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
      if (this.app.workspace.getLeavesOfType(FRAGMENTS_VIEW).length) void this.activateView();
    });
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) void this.library.refresh(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) void this.library.refresh(file);
      }),
    );
    this.registerEvent(this.app.vault.on("delete", (file) => this.library.remove(file.path)));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.library.remove(oldPath);
        if (file instanceof TFile) void this.library.refresh(file);
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
    this.app.workspace.detachLeavesOfType(FRAGMENTS_VIEW);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  activateView(): Promise<WorkspaceLeaf | undefined> {
    this.activation = this.activation.catch(() => undefined).then(() => this.openView());
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

  private async openView(): Promise<WorkspaceLeaf | undefined> {
    if (this.unloaded) return undefined;
    try {
      const workspace = this.app.workspace;
      const leaves = workspace.getLeavesOfType(FRAGMENTS_VIEW);
      const leaf = this.prepareLeaf(leaves);
      if (!(leaf.view instanceof FragmentsView))
        await leaf.setViewState({ type: FRAGMENTS_VIEW, active: true });
      await workspace.revealLeaf(leaf);
      for (const duplicate of leaves) if (duplicate !== leaf) duplicate.detach();
      return leaf;
    } catch {
      new Notice("Fragments could not open.");
      return undefined;
    }
  }

  private prepareLeaf(leaves: WorkspaceLeaf[]): WorkspaceLeaf {
    const workspace = this.app.workspace;
    const leaf =
      this.findWindowLeaf() ??
      leaves.find((item) => item.getContainer() !== workspace.rootSplit) ??
      leaves[0] ??
      workspace.getLeaf(Platform.isDesktopApp ? "window" : "tab");
    if (Platform.isDesktopApp && leaf.getContainer() === workspace.rootSplit)
      workspace.moveLeafToPopout(leaf);
    if (Platform.isDesktopApp && leaf.getContainer() !== workspace.rootSplit) {
      leaf.getContainer().doc.documentElement.setAttribute(WINDOW_MARKER, "true");
    }
    return leaf;
  }

  private findWindowLeaf(): WorkspaceLeaf | undefined {
    if (!Platform.isDesktopApp) return undefined;
    const workspace = this.app.workspace;
    let found: WorkspaceLeaf | undefined;
    workspace.iterateAllLeaves((leaf) => {
      const container = leaf.getContainer();
      if (
        !found &&
        container !== workspace.rootSplit &&
        container.doc.documentElement.hasAttribute(WINDOW_MARKER)
      ) {
        found =
          workspace
            .getLeavesOfType(FRAGMENTS_VIEW)
            .find((candidate) => candidate.getContainer() === container) ??
          workspace.getMostRecentLeaf(container) ??
          leaf;
      }
    });
    return found;
  }
}
