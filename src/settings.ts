import {
  App,
  FuzzySuggestModal,
  Notice,
  PluginSettingTab,
  Setting,
  type FuzzyMatch,
  type TextComponent,
} from "obsidian";
import { FolderSuggest } from "./folder-suggest";
import type { LibrarySettings } from "./library";
import type FragmentsPlugin from "./main";

export type SnippetFont = "monospace" | "text" | "interface" | "serif" | "custom";

export interface FragmentsSettings extends LibrarySettings {
  snippetFont: SnippetFont;
  customSnippetFont: string;
}

export const DEFAULT_SETTINGS: FragmentsSettings = {
  folder: "Fragments",
  snippetFont: "monospace",
  customSnippetFont: "",
};

interface FontChoice {
  label: string;
  font: SnippetFont;
  family?: string;
}

const BUILT_IN_FONTS: FontChoice[] = [
  { label: "Obsidian monospace", font: "monospace" },
  { label: "Obsidian text", font: "text" },
  { label: "Obsidian interface", font: "interface" },
  { label: "Serif", font: "serif" },
];

function quotedFontFamily(family: string): string {
  return `"${family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}", var(--font-monospace), monospace`;
}

class SnippetFontModal extends FuzzySuggestModal<FontChoice> {
  constructor(
    app: App,
    private readonly choices: FontChoice[],
    private readonly choose: (choice: FontChoice) => void,
  ) {
    super(app);
    this.setPlaceholder("Search installed fonts…");
    this.emptyStateText = "No matching fonts";
  }

  getItems(): FontChoice[] {
    return this.choices;
  }

  getItemText(choice: FontChoice): string {
    return choice.label;
  }

  renderSuggestion(match: FuzzyMatch<FontChoice>, el: HTMLElement): void {
    super.renderSuggestion(match, el);
    if (match.item.family) el.style.fontFamily = quotedFontFamily(match.item.family);
  }

  onChooseItem(choice: FontChoice): void {
    this.choose(choice);
  }
}

export function snippetFontFamily(
  settings: Pick<FragmentsSettings, "snippetFont" | "customSnippetFont">,
): string {
  switch (settings.snippetFont) {
    case "text":
      return "var(--font-text), sans-serif";
    case "interface":
      return "var(--font-interface), sans-serif";
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "custom":
      return settings.customSnippetFont.trim()
        ? quotedFontFamily(settings.customSnippetFont.trim())
        : "var(--font-monospace), monospace";
    case "monospace":
      return "var(--font-monospace), monospace";
  }
  return "var(--font-monospace), monospace";
}

export class FragmentsSettingTab extends PluginSettingTab {
  private folderSuggest: FolderSuggest | undefined;

  constructor(
    app: App,
    private readonly plugin: FragmentsPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    this.folderSuggest?.close();
    containerEl.empty();

    new Setting(containerEl).setName("Library").setHeading();
    new Setting(containerEl)
      .setName("Fragments folder")
      .setDesc(
        "Choose an existing vault folder or enter a new path. Subfolders become collections.",
      )
      .addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.folder).setValue(this.plugin.settings.folder);
        this.folderSuggest = new FolderSuggest(this.app, text.inputEl, () => {
          void this.updateFolder(text);
        });
        text.inputEl.addEventListener("change", () => void this.updateFolder(text));
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") text.inputEl.blur();
        });
      });

    new Setting(containerEl).setName("Appearance").setHeading();
    new Setting(containerEl)
      .setName("Snippet font")
      .setDesc("Used for Markdown editing and preview in Fragments.")
      .addButton((button) => {
        const selected = BUILT_IN_FONTS.find(
          (choice) => choice.font === this.plugin.settings.snippetFont,
        );
        button
          .setButtonText(selected?.label || this.plugin.settings.customSnippetFont || "Choose font")
          .onClick(() => void this.openFontPicker());
        button.buttonEl.style.fontFamily = snippetFontFamily(this.plugin.settings);
      });
  }

  hide(): void {
    this.folderSuggest?.close();
    this.folderSuggest = undefined;
    super.hide();
  }

  private async updateFolder(text: TextComponent): Promise<void> {
    if (text.getValue() === this.plugin.settings.folder) return;
    const previous = this.plugin.settings.folder;
    text.inputEl.disabled = true;
    try {
      await this.plugin.library.changeFolder(text.getValue());
      await this.plugin.saveSettings();
      text.setValue(this.plugin.settings.folder);
    } catch (error) {
      try {
        await this.plugin.library.changeFolder(previous);
      } catch (restoreError) {
        new Notice(`Could not reload the previous library: ${String(restoreError)}`);
      }
      text.setValue(previous);
      new Notice(`Could not change the Fragments folder: ${String(error)}`);
    } finally {
      text.inputEl.disabled = false;
    }
  }

  private async openFontPicker(): Promise<void> {
    const fontWindow = window as Window & {
      queryLocalFonts?: () => Promise<{ family: string }[]>;
    };
    let families: string[] = [];
    if (fontWindow.queryLocalFonts) {
      try {
        const fonts = await fontWindow.queryLocalFonts();
        families = [...new Set(fonts.map((font) => font.family).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b),
        );
      } catch (error) {
        new Notice(`Could not list installed fonts: ${String(error)}`);
      }
    }
    const choices = [
      ...BUILT_IN_FONTS,
      ...families.map((family): FontChoice => ({ label: family, font: "custom", family })),
    ];
    if (this.plugin.settings.snippetFont === "custom" && this.plugin.settings.customSnippetFont) {
      const family = this.plugin.settings.customSnippetFont;
      if (!families.includes(family)) choices.push({ label: family, font: "custom", family });
    }
    new SnippetFontModal(this.app, choices, (choice) => void this.updateFont(choice)).open();
  }

  private async updateFont(choice: FontChoice): Promise<void> {
    const previousFont = this.plugin.settings.snippetFont;
    const previousFamily = this.plugin.settings.customSnippetFont;
    this.plugin.settings.snippetFont = choice.font;
    if (choice.family) this.plugin.settings.customSnippetFont = choice.family;
    try {
      await this.plugin.saveSettings();
    } catch (error) {
      this.plugin.settings.snippetFont = previousFont;
      this.plugin.settings.customSnippetFont = previousFamily;
      new Notice(`Could not save the snippet font: ${String(error)}`);
    }
    this.display();
  }
}
