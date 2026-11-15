import { describe, expect, it, vi } from "vitest";
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
    iterateAllLeaves: () => undefined,
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
  it("keeps both leaves on startup but collapses them on an explicit open", async () => {
    const { plugin, workspace, settle, setLeaves } = setup();
    const rootSplit = workspace.rootSplit;
    const first = makeLeaf(rootSplit);
    const second = makeLeaf({ id: "popout" });
    first.view = new FragmentsView(first as never, plugin);
    second.view = new FragmentsView(second as never, plugin);
    setLeaves([first, second]);

    await plugin.onload();
    settle();
    await tick(40);

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
