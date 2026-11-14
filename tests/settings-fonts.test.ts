import { describe, expect, it, vi } from "vitest";
import type FragmentsPlugin from "../src/main";
import { FragmentsSettingTab, snippetFontFamily } from "../src/settings";
import { notices } from "./obsidian-stub";

describe("snippet font family", () => {
  it("maps each built-in choice", () => {
    expect(snippetFontFamily({ snippetFont: "monospace", customSnippetFont: "" })).toBe(
      "var(--font-monospace), monospace",
    );
    expect(snippetFontFamily({ snippetFont: "text", customSnippetFont: "" })).toBe(
      "var(--font-text), sans-serif",
    );
    expect(snippetFontFamily({ snippetFont: "interface", customSnippetFont: "" })).toBe(
      "var(--font-interface), sans-serif",
    );
    expect(snippetFontFamily({ snippetFont: "serif", customSnippetFont: "" })).toBe(
      'Georgia, "Times New Roman", serif',
    );
  });

  it("quotes and escapes a custom family", () => {
    expect(snippetFontFamily({ snippetFont: "custom", customSnippetFont: 'My "Font"' })).toBe(
      '"My \\"Font\\"", var(--font-monospace), monospace',
    );
  });

  it("falls back to monospace for an empty custom value", () => {
    expect(snippetFontFamily({ snippetFont: "custom", customSnippetFont: "  " })).toBe(
      "var(--font-monospace), monospace",
    );
  });
});

describe("choosing a snippet font", () => {
  const create = (saveSettings: () => Promise<void>) => {
    const plugin = {
      settings: { folder: "Fragments", snippetFont: "monospace", customSnippetFont: "" },
      saveSettings,
    } as unknown as FragmentsPlugin;
    const tab = new FragmentsSettingTab({} as never, plugin);
    // The DOM rebuild is covered by the settings tab itself; this test focuses
    // on the persistence and restore paths.
    vi.spyOn(tab, "display").mockImplementation(() => undefined);
    const updateFont = (
      tab as unknown as {
        updateFont: (choice: { font: string; family?: string }) => Promise<void>;
      }
    ).updateFont.bind(tab);
    return { plugin, updateFont };
  };

  it("persists the chosen font and custom family", async () => {
    const saveSettings = vi.fn(async () => undefined);
    const { plugin, updateFont } = create(saveSettings);
    await updateFont({ font: "custom", family: "Inter" });
    expect(plugin.settings.snippetFont).toBe("custom");
    expect(plugin.settings.customSnippetFont).toBe("Inter");
    expect(saveSettings).toHaveBeenCalledTimes(1);
  });

  it("restores the previous font when the save fails", async () => {
    notices.length = 0;
    const saveSettings = vi.fn(async () => {
      throw new Error("disk full");
    });
    const { plugin, updateFont } = create(saveSettings);
    await updateFont({ font: "serif" });
    expect(plugin.settings.snippetFont).toBe("monospace");
    expect(plugin.settings.customSnippetFont).toBe("");
    expect(notices.join()).toContain("Could not save the snippet font");
  });
});
