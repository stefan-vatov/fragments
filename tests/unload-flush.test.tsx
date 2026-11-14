import { act } from "react";
import { describe, expect, it, vi } from "vitest";
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

describe("plugin unload", () => {
  it("flushes the open draft before detaching the view", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);

    let leaf: { view?: unknown } = {};
    const detachLeavesOfType = vi.fn();
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [leaf],
        detachLeavesOfType,
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
    await act(async () => {
      await view.onOpen();
    });

    const editor = view.contentEl.querySelector<HTMLTextAreaElement>("textarea");
    expect(editor).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(editor, "Body, still typing.");
      editor?.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Quit before the 700 ms autosave debounce fires.
    plugin.onunload();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(files.get("Fragments/Note.md")?.text ?? "").toContain("Body, still typing.");
    expect(detachLeavesOfType).toHaveBeenCalled();
  });
});
