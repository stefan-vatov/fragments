import { Platform } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FragmentsPlugin from "../src/main";
import { FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

const tick = (ms = 20): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const makeLeaf = (container: unknown) => ({
  view: undefined as unknown,
  setViewState: vi.fn(async () => undefined),
  detach: vi.fn(),
  getContainer: () => container,
  reveal: vi.fn(async () => undefined),
});

const setup = () => {
  const { app } = createTestVault();
  const rootSplit = { id: "root" };
  let leaves: ReturnType<typeof makeLeaf>[] = [];
  const readyCallbacks: Array<() => void> = [];
  const marker = document.createElement("div");
  marker.setAttribute("data-fragments-app-window", "true");
  const noteLeaf = makeLeaf({ doc: { documentElement: marker } });
  const workspace = {
    rootSplit,
    getLeavesOfType: vi.fn(() => leaves),
    getLeaf: vi.fn(() => makeLeaf(rootSplit)),
    moveLeafToPopout: vi.fn(async () => undefined),
    revealLeaf: vi.fn(async () => undefined),
    detachLeavesOfType: vi.fn(),
    onLayoutReady: (callback: () => void) => {
      readyCallbacks.push(callback);
    },
    iterateAllLeaves: (callback: (leaf: ReturnType<typeof makeLeaf>) => void) => {
      callback(noteLeaf);
      for (const leaf of leaves) callback(leaf);
    },
    setActiveLeaf: vi.fn(),
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
  return {
    plugin,
    workspace,
    settle: () => {
      for (const callback of readyCallbacks) callback();
    },
    setLeaves: (next: ReturnType<typeof makeLeaf>[]) => {
      leaves = next;
    },
  };
};

describe("a restored workspace with two Fragments leaves", () => {
  beforeEach(() => {
    (Platform as { isDesktopApp?: boolean }).isDesktopApp = true;
  });
  afterEach(() => {
    (Platform as { isDesktopApp?: boolean }).isDesktopApp = false;
  });
  it("keeps both leaves on startup but collapses them on an explicit open", async () => {
    const { plugin, workspace, settle, setLeaves } = setup();
    const rootSplit = workspace.rootSplit;
    const first = makeLeaf(rootSplit);
    const second = makeLeaf({ doc: { documentElement: document.createElement("div") } });
    first.view = new FragmentsView(first as never, plugin);
    second.view = new FragmentsView(second as never, plugin);
    setLeaves([first, second]);

    await plugin.onload();
    settle();
    await tick(40);

    // A marked window whose Fragments view was replaced must not divert restore.
    expect(workspace.setActiveLeaf).not.toHaveBeenCalled();
    expect(workspace.getLeaf).not.toHaveBeenCalled();
    expect(workspace.moveLeafToPopout).not.toHaveBeenCalled();
    expect(workspace.revealLeaf).not.toHaveBeenCalled();
    // The restore must not discard the second leaf.
    expect(first.detach).not.toHaveBeenCalled();
    expect(second.detach).not.toHaveBeenCalled();

    // An explicit open still collapses the duplicates.
    await plugin.activateView();
    await tick(40);
    expect(second.detach).not.toHaveBeenCalled();
    expect(first.detach).toHaveBeenCalledTimes(1);
  });
});
