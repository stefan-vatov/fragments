// Minimal runtime stand-in for the `obsidian` module.
//
// The plugin bundle marks `obsidian` as external because the real module only
// exists inside the desktop app. Tests alias it to this file so the real
// components and the real FragmentLibrary can run under jsdom.

export class App {}

export class TAbstractFile {
  path = "";
  name = "";
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  basename = "";
  extension = "md";
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export const normalizePath = (path: string): string =>
  path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");

export interface FrontMatterInfo {
  exists: boolean;
  frontmatter: string;
  contentStart: number;
}

export const getFrontMatterInfo = (source: string): FrontMatterInfo => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { exists: false, frontmatter: "", contentStart: 0 };
  return { exists: true, frontmatter: match[1], contentStart: match[0].length };
};

export const notices: string[] = [];

export class Notice {
  constructor(readonly message: string) {
    notices.push(message);
  }
}

export const Platform = { isMacOS: false };

export const MarkdownRenderer = {
  render: async (
    _app: App,
    _markdown: string,
    _element: HTMLElement,
    _sourcePath: string,
    _component: unknown,
  ): Promise<void> => undefined,
};

export class AbstractInputSuggest<T> {
  limit = 0;
  constructor(
    readonly app: App,
    readonly inputEl: HTMLInputElement,
  ) {}
  setValue(_value: string): void {}
  close(): void {}
  protected getSuggestions(_query: string): T[] {
    return [];
  }
}

export class FuzzySuggestModal<T> {
  emptyStateText = "";
  constructor(readonly app: App) {}
  setPlaceholder(_text: string): void {}
  renderSuggestion(_match: unknown, _el: HTMLElement): void {}
  protected getItems(): T[] {
    return [];
  }
}

export class PluginSettingTab {
  constructor(
    readonly app: App,
    readonly plugin: unknown,
  ) {}
  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(readonly containerEl: HTMLElement) {}
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  setHeading(): this {
    return this;
  }
  addText(_build: unknown): this {
    return this;
  }
  addButton(_build: unknown): this {
    return this;
  }
}

export class Plugin {
  constructor(
    readonly app: App,
    readonly manifest: unknown,
  ) {}
  async saveData(_data: unknown): Promise<void> {}
}

export class ItemView {
  readonly containerEl: HTMLElement = document.body;
  readonly contentEl: HTMLElement = document.createElement("div");
  constructor(readonly leaf: unknown) {}
}
