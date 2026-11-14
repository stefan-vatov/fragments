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

const note = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("renaming the open fragment outside Fragments", () => {
  it("keeps the unsaved draft by following the file", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    const file = addFile("Fragments/Alpha.md", note, 1_000);

    const handlers: Record<string, (file: unknown, oldPath?: string) => void> = {};
    let leaf: { view?: unknown } = {};
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [leaf],
        detachLeavesOfType: () => undefined,
      },
    });
    (app.vault as unknown as Record<string, unknown>).on = (
      event: string,
      callback: (file: unknown, oldPath?: string) => void,
    ) => {
      handlers[event] = callback;
      return {};
    };
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

    // Another leaf renames the note before the 700 ms autosave fires.
    await act(async () => {
      await app.fileManager.renameFile(file, "Fragments/Alpha renamed.md");
      handlers.rename?.(file, "Fragments/Alpha.md");
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(files.get("Fragments/Alpha renamed.md")?.text ?? "").toContain("Body, still typing.");
  });
});
