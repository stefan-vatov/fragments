import { AbstractInputSuggest, type App, type TFolder } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    input: HTMLInputElement,
    private readonly choose: (path: string) => void,
  ) {
    super(app, input);
    this.limit = 50;
  }

  protected getSuggestions(query: string): TFolder[] {
    const search = query.trim().toLowerCase();
    const prefix: TFolder[] = [];
    const matches: TFolder[] = [];
    for (const folder of this.app.vault.getAllFolders()) {
      const path = folder.path.toLowerCase();
      if (path.startsWith(search)) prefix.push(folder);
      else if (path.includes(search)) matches.push(folder);
    }
    return [...prefix, ...matches].slice(0, this.limit);
  }

  renderSuggestion(folder: TFolder, element: HTMLElement): void {
    element.textContent = folder.path;
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.close();
    this.choose(folder.path);
  }
}
