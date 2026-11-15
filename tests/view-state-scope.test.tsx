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

const tick = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("a tampered restored scope", () => {
  it("does not create folders outside the library root", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, files } = createTestVault();
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
    await act(async () => {
      await view.setState({ fragments: { scope: { kind: "collection", value: "../outside" } } });
      await view.onOpen();
      await tick();
    });

    const create = [...view.contentEl.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "New Snippet",
    );
    expect(create).not.toBeNull();
    await act(async () => {
      create?.click();
      await tick(120);
    });

    expect([...files.keys()].filter((path) => path.includes(".."))).toEqual([]);
    expect([...files.keys()].some((path) => path.startsWith("Fragments/Untitled fragment"))).toBe(
      true,
    );
    await act(async () => {
      await view.onClose();
    });
  });

  it("rejects traversal segments in ensureFolder's callers", async () => {
    const { app } = createTestVault();
    (app.vault as unknown as Record<string, unknown>).on = () => ({});
    (app.metadataCache as unknown as Record<string, unknown>).on = () => ({});
    const { FragmentLibrary } = await import("../src/library");
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await expect(library.create("../outside")).rejects.toThrow(/cannot contain/);
  });
});
