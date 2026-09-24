import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { AppShell, type ShellHandle } from "./app";
import type FragmentsPlugin from "./main";

export const FRAGMENTS_VIEW = "fragments-view";

export class FragmentsView extends ItemView {
  private root: Root | undefined;
  private shell: ShellHandle | null = null;

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
      <AppShell
        plugin={this.plugin}
        view={this}
        handle={(value) => {
          this.shell = value;
        }}
      />,
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = undefined;
    this.shell = null;
  }

  async createFragment(): Promise<void> {
    await this.shell?.createFragment();
  }
  openPalette(): void {
    this.shell?.openPalette();
  }
}
