import { Platform } from "obsidian";
import { afterAll, describe, expect, it, vi } from "vitest";
import FragmentsPlugin from "../src/main";
import { createTestVault } from "./vault";

const note = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("reopening Fragments in a popout", () => {
  afterAll(() => {
    delete (Platform as unknown as { isDesktopApp?: boolean }).isDesktopApp;
  });

  it("reuses the marked app window while preserving its unrelated note tab", async () => {
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
    let activeContainer: unknown = rootSplit;
    let createdContainer: unknown;
    const freshLeaf = {
      view: {},
      getContainer: () => createdContainer,
      setViewState: vi.fn(async () => undefined),
    };
    const workspace = {
      rootSplit,
      onLayoutReady: (callback: () => void) => callback(),
      iterateAllLeaves: (callback: (leaf: unknown) => void) => callback(noteLeaf),
      getLeavesOfType: () => [],
      setActiveLeaf: vi.fn((leaf: typeof noteLeaf) => {
        activeContainer = leaf.getContainer();
      }),
      getLeaf: vi.fn((mode: string) => {
        createdContainer =
          mode === "tab"
            ? activeContainer
            : { doc: { documentElement: document.createElement("div") } };
        return freshLeaf;
      }),
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

    // The note survives in its tab, and Fragments opens beside it in the same window.
    expect(noteLeaf.setViewState).not.toHaveBeenCalled();
    expect(leaf?.getContainer()).toBe(popout);
    expect(workspace.moveLeafToPopout).not.toHaveBeenCalled();
    expect(freshLeaf.setViewState).toHaveBeenCalledWith({ type: "fragments-view", active: true });
    expect(leaf).toBe(freshLeaf);
  });
});
