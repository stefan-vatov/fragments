import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import FragmentsPlugin from "../src/main";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("renaming the library root outside Fragments", () => {
  it("re-points the setting and keeps the library usable", async () => {
    document.body.replaceChildren();
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);

    const handlers: Record<string, (file: unknown, oldPath?: string) => void> = {};
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [],
      },
    });
    (app.vault as unknown as Record<string, unknown>).on = (
      event: string,
      callback: (file: unknown, oldPath?: string) => void,
    ) => {
      handlers[event] = callback;
      return {};
    };
    (app.metadataCache as unknown as Record<string, unknown>).on = () => ({});

    const plugin = new FragmentsPlugin(app as never, {} as never);
    Object.assign(plugin, {
      loadData: async () => null,
      registerView: () => undefined,
      addSettingTab: () => undefined,
      addRibbonIcon: () => undefined,
      addCommand: () => undefined,
      registerObsidianProtocolHandler: () => undefined,
      registerEvent: () => undefined,
    });
    const saveData = vi.spyOn(plugin, "saveData");
    await plugin.onload();
    expect(plugin.settings.folder).toBe("Fragments");

    // Another leaf renames the folder; Obsidian emits one folder-level event.
    files.delete("Fragments/Note.md");
    addFile("Snippets/Note.md", note, 2_000);
    const folder = app.vault.getAbstractFileByPath("Snippets");
    expect(folder).not.toBeNull();
    await act(async () => {
      handlers.rename?.(folder, "Fragments");
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(plugin.settings.folder).toBe("Snippets");
    expect(saveData).toHaveBeenCalled();
    expect(plugin.library.folder()).toBe("Snippets");
    expect(plugin.library.entries().map((item) => item.path)).toEqual(["Snippets/Note.md"]);
  });
});
