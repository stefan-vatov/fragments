import { Platform } from "obsidian";
import { afterAll, describe, expect, it, vi } from "vitest";
import FragmentsPlugin from "../src/main";
import { createTestVault } from "./vault";

const note = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("reopening Fragments in a popout", () => {
  afterAll(() => {
    delete (Platform as unknown as { isDesktopApp?: boolean }).isDesktopApp;
  });

  it("creates a fresh leaf instead of replacing an unrelated note tab", async () => {
    (Platform as unknown as { isDesktopApp?: boolean }).isDesktopApp = true;
    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note, 1_000);

    const marker = document.createElement("div");
    marker.setAttribute("data-fragments-app-window", "true");
    const popout = { doc: { documentElement: marker } };
    const rootSplit = { id: "root" };

    const noteLeaf = {
      view: { getViewType: () => "markdown" },
      getContainer: () => popout,
      setViewState: vi.fn(async () => undefined),
    };
    const freshLeaf = {
      view: {},
      getContainer: () => rootSplit,
      setViewState: vi.fn(async () => undefined),
    };
    const workspace = {
      rootSplit,
      onLayoutReady: (callback: () => void) => callback(),
      iterateAllLeaves: (callback: (leaf: unknown) => void) => callback(noteLeaf),
      getLeavesOfType: () => [],
      getMostRecentLeaf: () => noteLeaf,
      getLeaf: vi.fn(() => freshLeaf),
      moveLeafToPopout: vi.fn(async () => undefined),
      revealLeaf: vi.fn(async () => undefined),
      detachLeavesOfType: vi.fn(),
    };
    Object.assign(app as unknown as Record<string, unknown>, { workspace });
    (app.vault as unknown as Record<string, unknown>).on = () => ({});
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

    const leaf = await plugin.activateView();

    // The popout's note tab must survive; Fragments gets its own tab/window.
    expect(noteLeaf.setViewState).not.toHaveBeenCalled();
    expect(workspace.getLeaf).toHaveBeenCalledWith("window");
    expect(freshLeaf.setViewState).toHaveBeenCalledWith({ type: "fragments-view", active: true });
    expect(leaf).toBe(freshLeaf);
  });
});
