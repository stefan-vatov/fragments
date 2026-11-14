import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FragmentsPlugin from "../src/main";
import { FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("a render error", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a fallback with a retry instead of a blank view", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { app, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);
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

    // React retries a failed render once in dev, so the failure must persist
    // until the retry button is used.
    const entries = plugin.library.entries.bind(plugin.library);
    let failing = true;
    plugin.library.entries = () => {
      if (failing) throw new Error("render boom");
      return entries();
    };

    const view = new FragmentsView(leaf as never, plugin);
    leaf = { view };
    await act(async () => {
      await view.onOpen();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(view.contentEl.textContent ?? "").toContain("Something went wrong");
    const retry = [...view.contentEl.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).not.toBeUndefined();

    failing = false;
    await act(async () => {
      retry?.click();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(view.contentEl.querySelectorAll(".fragments-result").length).toBe(1);
  });
});
