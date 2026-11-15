import { describe, expect, it, vi } from "vitest";
import FragmentsPlugin from "../src/main";
import { FRAGMENTS_VIEW, FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const setup = async () => {
  const { app } = createTestVault();
  const leaf = {
    view: undefined as unknown,
    setViewState: vi.fn(async () => undefined),
    detach: vi.fn(),
    getContainer: () => ({}),
  };
  const workspace = {
    getLeavesOfType: vi.fn(() => [leaf]),
    detachLeavesOfType: vi.fn(),
    onLayoutReady: () => undefined,
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
    saveSettings: async () => undefined,
  });
  await plugin.onload();
  return { plugin, leaf, workspace };
};

describe("plugin unload and the draft flush", () => {
  it("settles a queued draft and detaches when no shell was ever installed", async () => {
    const { plugin, leaf, workspace } = await setup();
    const view = new FragmentsView(leaf as never, plugin);
    leaf.view = view;

    // onOpen() never ran, so the React shell cannot accept the action yet.
    const saved = view.saveDraft();
    const early = await Promise.race([saved.then(() => "settled"), tick(60).then(() => "pending")]);
    expect(early).toBe("pending");

    plugin.onunload();
    await tick(80);
    await expect(saved).resolves.toBeUndefined();
    expect(workspace.detachLeavesOfType).toHaveBeenCalledWith(FRAGMENTS_VIEW);
  });

  it("still flushes the draft of a committed shell before detaching", async () => {
    const { plugin, leaf, workspace } = await setup();
    const view = new FragmentsView(leaf as never, plugin);
    leaf.view = view;
    const saveDraft = vi.fn(async () => undefined);
    (view as unknown as { install(value: unknown): void }).install({ saveDraft });

    plugin.onunload();
    await tick(80);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(workspace.detachLeavesOfType).toHaveBeenCalledWith(FRAGMENTS_VIEW);
  });
});
