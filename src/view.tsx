import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { AppShell, type ShellHandle } from "./app";
import { ErrorBoundary } from "./error-boundary";
import type FragmentsPlugin from "./main";
import type { SearchScope } from "./search";

export const FRAGMENTS_VIEW = "fragments-view";

// The part of the UI Obsidian restores with the leaf: which fragment is open,
// the active filters, the view mode and the pad's visibility.
export interface FragmentsViewState {
  selected: string | null;
  scope: SearchScope;
  query: string;
  tagFilter: string;
  sort: "recent" | "name";
  mode: "edit" | "preview";
  mobilePane: "nav" | "list" | "editor";
  scratchOpen: boolean;
}

// What the view serialises into Obsidian's workspace file. The index signature
// keeps it assignable to the base `View.getState()` contract.
export interface SerializedFragmentsState {
  // Obsidian's workspace contract is an open dictionary; only `fragments` is ours.
  // oxlint-disable-next-line thethracian/no-unsafe-dictionary-type
  [key: string]: unknown;
  fragments: FragmentsViewState;
}

export class FragmentsView extends ItemView {
  private root: Root | undefined;
  private shell: ShellHandle | null = null;
  private snapshot: FragmentsViewState | null = null;
  private scratchOpen = true;
  private closed = false;
  // Commands can run before the first React commit installs the shell; keep
  // their intent instead of dropping it.
  private pending: Array<{
    action: (shell: ShellHandle) => void | Promise<void>;
    resolve: () => void;
  }> = [];

  private install(value: ShellHandle | null): void {
    this.shell = value;
    if (!value) return;
    const queued = this.pending;
    this.pending = [];
    for (const item of queued) void Promise.resolve(item.action(value)).then(item.resolve);
  }

  private run(action: (shell: ShellHandle) => void | Promise<void>): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.shell) return Promise.resolve(action(this.shell));
    return new Promise((resolve) => this.pending.push({ action, resolve }));
  }

  // The plugin is unloading: a queued command can never run, so settle it
  // instead of leaving onunload's draft flush waiting forever. A committed
  // shell can still flush its draft, so its queue is left alone.
  abortPending(): void {
    if (this.shell) return;
    this.closed = true;
    const queued = this.pending;
    this.pending = [];
    for (const item of queued) item.resolve();
  }

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: FragmentsPlugin,
  ) {
    super(leaf);
  }
  getViewType(): string {
    return FRAGMENTS_VIEW;
  }
  getDisplayText(): string {
    return "Fragments";
  }
  getIcon(): string {
    return "blocks";
  }

  // Obsidian serialises the view state with the workspace; the controller reads
  // it at mount and keeps it current.
  getState(): SerializedFragmentsState {
    const state: FragmentsViewState = {
      ...(this.snapshot ?? {
        selected: null,
        scope: { kind: "all" },
        query: "",
        tagFilter: "",
        sort: "recent",
        mode: "edit",
        mobilePane: "list",
      }),
      scratchOpen: this.scratchOpen,
    };
    return { fragments: state };
  }

  async setState(state: { fragments?: Partial<FragmentsViewState> } | null): Promise<void> {
    const stored = state?.fragments;
    this.snapshot = stored
      ? {
          selected: stored.selected ?? null,
          scope: stored.scope ?? { kind: "all" },
          query: stored.query ?? "",
          tagFilter: stored.tagFilter ?? "",
          sort: stored.sort === "name" ? "name" : "recent",
          mode: stored.mode === "preview" ? "preview" : "edit",
          mobilePane:
            stored.mobilePane === "nav" || stored.mobilePane === "editor"
              ? stored.mobilePane
              : "list",
          scratchOpen: stored.scratchOpen ?? true,
        }
      : null;
    this.scratchOpen = stored?.scratchOpen ?? true;
  }

  readState(): FragmentsViewState | null {
    return this.snapshot;
  }

  rememberState(state: Omit<FragmentsViewState, "scratchOpen">): void {
    this.snapshot = { ...state, scratchOpen: this.scratchOpen };
  }

  readScratchOpen(): boolean {
    return this.scratchOpen;
  }

  rememberScratchOpen(open: boolean): void {
    this.scratchOpen = open;
    if (this.snapshot) this.snapshot = { ...this.snapshot, scratchOpen: open };
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("fragments-host");
    this.root = createRoot(this.contentEl);
    this.root.render(
      <ErrorBoundary>
        <AppShell plugin={this.plugin} view={this} handle={(value) => this.install(value)} />
      </ErrorBoundary>,
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = undefined;
    this.install(null);
    // A command aimed at a closed view resolves without acting.
    this.abortPending();
  }

  async createFragment(): Promise<void> {
    await this.run((shell) => shell.createFragment());
  }
  openPalette(): void {
    void this.run((shell) => shell.openPalette());
  }
  async saveDraft(): Promise<void> {
    await this.run((shell) => shell.saveDraft());
  }
}
