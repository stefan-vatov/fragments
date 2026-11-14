import { describe, expect, it } from "vitest";
import FragmentsPlugin from "../src/main";
import { createTestVault } from "./vault";

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("unloading during the initial load", () => {
  it("stops reading bodies once the plugin unloads", async () => {
    const { app, vault, addFile } = createTestVault();
    for (let index = 0; index < 20; index += 1)
      addFile(`Fragments/Note ${index}.md`, note(`Note ${index}`), 1_000);

    const gates: Array<() => void> = [];
    let calls = 0;
    vault.cachedRead = () =>
      new Promise<string>((resolve) => {
        calls += 1;
        gates.push(() => resolve("Body."));
      });

    const handlers: Record<string, unknown> = {};
    (app.vault as unknown as Record<string, unknown>).on = (event: string, callback: unknown) => {
      handlers[event] = callback;
      return {};
    };
    (app.metadataCache as unknown as Record<string, unknown>).on = () => ({});
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [],
        detachLeavesOfType: () => undefined,
      },
    });

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

    // The first batch parks on the gated reads.
    for (let index = 0; index < 100 && calls < 16; index += 1) await tick(5);
    expect(calls).toBe(16);

    plugin.onunload();
    for (const gate of gates.splice(0)) gate();
    await tick(100);
    expect(calls).toBe(16);
  });
});
