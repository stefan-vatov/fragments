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

const note = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nAlpha body\n`;
const tick = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("renaming a collection folder outside Fragments", () => {
  it("keeps the unsaved draft by following the moved file", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Studio/Alpha.md", note, 1_000);

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
      await tick();
    });

    const editor = (): HTMLTextAreaElement | null =>
      view.contentEl.querySelector<HTMLTextAreaElement>(".fragments-editor");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(editor(), "Draft text");
      editor()?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });

    // The folder is renamed before the 700 ms autosave fires.
    const entry = files.get("Fragments/Studio/Alpha.md");
    if (!entry) throw new Error("missing file");
    files.delete("Fragments/Studio/Alpha.md");
    addFile("Fragments/Archive/Alpha.md", entry.text, entry.file.stat.mtime);
    const folder = app.vault.getAbstractFileByPath("Fragments/Archive");
    expect(folder).not.toBeNull();
    await act(async () => {
      handlers.rename?.(folder, "Fragments/Studio");
      await tick(200);
    });

    expect(files.get("Fragments/Archive/Alpha.md")?.text).toContain("Draft text");
    expect(
      view.contentEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]')?.value,
    ).toBe("Alpha");
    expect(view.contentEl.querySelector('textarea[aria-label="Recovered draft"]')).toBeNull();
    await act(async () => {
      await view.onClose();
    });
  });
});
