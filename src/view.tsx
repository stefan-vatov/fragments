import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { AppShell, type ShellHandle } from "./app";
import type FragmentsPlugin from "./main";

export const FRAGMENTS_VIEW = "fragments-view";

export class FragmentsView extends ItemView {
  private root: Root | undefined;
  private shell: ShellHandle | null = null;
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
    if (this.shell) return Promise.resolve(action(this.shell));
    return new Promise((resolve) => this.pending.push({ action, resolve }));
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

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("fragments-host");
    this.root = createRoot(this.contentEl);
    this.root.render(
      <AppShell plugin={this.plugin} view={this} handle={(value) => this.install(value)} />,
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = undefined;
    this.install(null);
    // A command aimed at a closed view resolves without acting.
    for (const item of this.pending) item.resolve();
    this.pending = [];
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
