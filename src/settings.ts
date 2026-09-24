import type { LibrarySettings } from "./library";

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
