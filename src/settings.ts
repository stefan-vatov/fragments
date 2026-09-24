import { App, Notice, PluginSettingTab, Setting, type TextComponent } from "obsidian";
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
      return settings.customSnippetFont.trim() || "var(--font-monospace), monospace";
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
      .addDropdown((dropdown) => {
        dropdown
          .addOption("monospace", "Obsidian monospace")
          .addOption("text", "Obsidian text")
          .addOption("interface", "Obsidian interface")
          .addOption("serif", "Serif")
          .addOption("custom", "Custom font family")
          .setValue(this.plugin.settings.snippetFont)
          .onChange((value) => void this.updateFont(value as SnippetFont));
      });

    if (this.plugin.settings.snippetFont === "custom") {
      new Setting(containerEl)
        .setName("Custom font family")
        .setDesc("Enter the name of a font installed on this device.")
        .addText((text) => {
          text.setPlaceholder("Iosevka").setValue(this.plugin.settings.customSnippetFont);
          text.inputEl.addEventListener("change", () => void this.updateCustomFont(text));
          text.inputEl.addEventListener("keydown", (event) => {
            if (event.key === "Enter") text.inputEl.blur();
          });
        });
    }
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

  private async updateFont(font: SnippetFont): Promise<void> {
    const previous = this.plugin.settings.snippetFont;
    this.plugin.settings.snippetFont = font;
    try {
      await this.plugin.saveSettings();
    } catch (error) {
      this.plugin.settings.snippetFont = previous;
      new Notice(`Could not save the snippet font: ${String(error)}`);
    }
    this.display();
  }

  private async updateCustomFont(text: TextComponent): Promise<void> {
    const previous = this.plugin.settings.customSnippetFont;
    this.plugin.settings.customSnippetFont = text.getValue().trim();
    try {
      await this.plugin.saveSettings();
      text.setValue(this.plugin.settings.customSnippetFont);
    } catch (error) {
      this.plugin.settings.customSnippetFont = previous;
      text.setValue(previous);
      new Notice(`Could not save the custom font: ${String(error)}`);
    }
  }
}
