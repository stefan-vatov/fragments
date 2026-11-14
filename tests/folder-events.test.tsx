import { describe, expect, it } from "vitest";
import FragmentsPlugin from "../src/main";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("folders created outside Fragments", () => {
  it("appear in the collections list", async () => {
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);

    const handlers: Record<string, (file: unknown, oldPath?: string) => void> = {};
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [],
        detachLeavesOfType: () => undefined,
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
    await plugin.onload();

    // Warm the collection cache with the current (folder-less) tree.
    expect(plugin.library.collections()).toEqual([]);

    await app.vault.createFolder("Fragments/Notes");
    const folder = app.vault.getAbstractFileByPath("Fragments/Notes");
    expect(folder).not.toBeNull();
    handlers.create?.(folder);

    expect(plugin.library.collections()).toContain("Notes");
  });
});
