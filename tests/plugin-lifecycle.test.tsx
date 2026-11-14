import { describe, expect, it, vi } from "vitest";
import FragmentsPlugin from "../src/main";
import { FRAGMENTS_VIEW, FragmentsView } from "../src/view";
import { notices } from "./obsidian-stub";
import { createTestVault } from "./vault";

const tick = (ms = 20): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface FakeLeaf {
  view?: unknown;
  setViewState: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
  getContainer: () => unknown;
}

const makeLeaf = (rootSplit: unknown, view?: unknown): FakeLeaf => ({
  view,
  setViewState: vi.fn(async () => undefined),
  detach: vi.fn(),
  getContainer: () => rootSplit,
});

const setup = (options: { leaves?: FakeLeaf[]; failOnLeaves?: boolean } = {}) => {
  const { app } = createTestVault();
  const rootSplit = {};
  let leaves = options.leaves ?? [];
  const created = makeLeaf(rootSplit);
  const readyCallbacks: Array<() => void> = [];
  const workspace = {
    rootSplit,
    getLeavesOfType: vi.fn(() => {
      if (options.failOnLeaves) throw new Error("workspace unavailable");
      return leaves;
    }),
    getLeaf: vi.fn(() => created),
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

  const commands: Record<string, () => void> = {};
  const protocols: Record<string, () => Promise<void>> = {};
  const plugin = new FragmentsPlugin(app as never, {} as never);
  Object.assign(plugin, {
    loadData: async () => null,
    registerView: () => undefined,
    addSettingTab: () => undefined,
    addRibbonIcon: () => undefined,
    addCommand: (command: { id: string; callback: () => void }) => {
      commands[command.id] = command.callback;
    },
    registerObsidianProtocolHandler: (name: string, handler: () => Promise<void>) => {
      protocols[name] = handler;
    },
    registerEvent: () => undefined,
    saveSettings: async () => undefined,
  });
  const settle = (): void => {
    for (const callback of readyCallbacks) callback();
  };
  return {
    plugin,
    workspace,
    commands,
    protocols,
    created,
    settle,
    setLeaves: (next: FakeLeaf[]) => {
      leaves = next;
    },
  };
};

describe("plugin lifecycle", () => {
  it("opens a tab when no Fragments leaf exists", async () => {
    const { plugin, commands, created, workspace } = setup();
    await plugin.onload();
    commands.open();
    await tick();
    expect(workspace.getLeaf).toHaveBeenCalledTimes(1);
    expect(created.setViewState).toHaveBeenCalledWith({ type: FRAGMENTS_VIEW, active: true });
    expect(workspace.revealLeaf).toHaveBeenCalledWith(created);
  });

  it("keeps one leaf and detaches duplicates", async () => {
    const { plugin, commands, workspace, setLeaves } = setup();
    const first = makeLeaf({});
    const second = makeLeaf({});
    const view = new FragmentsView(first as never, plugin);
    first.view = view;
    setLeaves([first, second]);
    await plugin.onload();
    commands.open();
    await tick();
    expect(first.setViewState).not.toHaveBeenCalled();
    expect(workspace.revealLeaf).toHaveBeenCalledWith(first);
    expect(second.detach).toHaveBeenCalled();
  });

  it("forwards the new-fragment and search commands to the view", async () => {
    const { plugin, commands, setLeaves } = setup();
    const leaf = makeLeaf({});
    const view = new FragmentsView(leaf as never, plugin);
    leaf.view = view;
    setLeaves([leaf]);
    const create = vi.spyOn(view, "createFragment").mockResolvedValue(undefined);
    const palette = vi.spyOn(view, "openPalette").mockImplementation(() => undefined);
    await plugin.onload();
    commands["new-fragment"]();
    await tick();
    expect(create).toHaveBeenCalled();
    commands.search();
    await tick();
    expect(palette).toHaveBeenCalled();
  });

  it("opens the view from the fragments protocol handler", async () => {
    const { plugin, protocols, workspace, created } = setup();
    await plugin.onload();
    await protocols.fragments();
    expect(workspace.revealLeaf).toHaveBeenCalledWith(created);
  });

  it("reports a workspace failure instead of throwing", async () => {
    notices.length = 0;
    const { plugin, commands } = setup({ failOnLeaves: true });
    await plugin.onload();
    commands.open();
    await tick();
    expect(notices).toContain("Fragments could not open.");
  });

  it("flushes every open editor's draft", async () => {
    const { plugin, setLeaves } = setup();
    const leaf = makeLeaf({});
    const view = new FragmentsView(leaf as never, plugin);
    leaf.view = view;
    setLeaves([leaf]);
    const save = vi.spyOn(view, "saveDraft").mockResolvedValue(undefined);
    await plugin.onload();
    await plugin.flushDrafts();
    expect(save).toHaveBeenCalled();
  });
});
