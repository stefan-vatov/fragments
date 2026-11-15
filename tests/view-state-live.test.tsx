import { act } from "react";
import { describe, expect, it } from "vitest";
import FragmentsPlugin from "../src/main";
import { FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body\n`;

const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("view state applied to an open leaf", () => {
  it("adopts the restored selection without recreating the leaf", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note("Alpha"), Date.now() - 86_400_000);
    addFile("Fragments/Beta.md", note("Beta"), Date.now());
    let leaf: { view?: unknown } = {};
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [leaf],
        detachLeavesOfType: () => undefined,
      },
    });
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

    const view = new FragmentsView(leaf as never, plugin);
    leaf = { view };
    document.body.append(view.contentEl);
    const title = (): string | undefined =>
      view.contentEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]')?.value;
    await act(async () => {
      await view.setState({ fragments: { selected: "Fragments/Alpha.md" } });
      await view.onOpen();
      await tick();
    });
    expect(title()).toBe("Alpha");

    // Obsidian reapplies the state to a leaf that is already open.
    await act(async () => {
      await view.setState({ fragments: { selected: "Fragments/Beta.md" } });
      await tick();
    });
    expect(title()).toBe("Beta");

    await act(async () => {
      await view.onClose();
    });
  });
});
