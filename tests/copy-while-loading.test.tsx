import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../src/app";
import { FragmentLibrary } from "../src/library";
import type FragmentsPlugin from "../src/main";
import type { FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\ncopy me\n`;

describe("copy while the fragment is still loading", () => {
  it("does not overwrite the clipboard with an empty string", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { app, vault, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    const expectedBody = await library.read("Fragments/Note.md");

    // Hold the *draft* read (issued when the view mounts) so Copy is pressed
    // while the fragment is still loading.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = vault.cachedRead;
    vault.cachedRead = async (file) => {
      await gate;
      return original(file);
    };
    const plugin = {
      app,
      library,
      settings: { folder: "Fragments", snippetFont: "monospace", customSnippetFont: "" },
      subscribeSettings: () => () => undefined,
      settingsSnapshot: () => 0,
    } as unknown as FragmentsPlugin;
    const viewEl = document.createElement("div");
    document.body.append(viewEl);
    const view = { containerEl: viewEl, contentEl: viewEl } as unknown as FragmentsView;
    const root = createRoot(viewEl);
    await act(async () => {
      root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
    });

    const copy = viewEl.querySelector<HTMLButtonElement>('button[aria-label="Copy fragment"]');
    expect(copy).not.toBeNull();
    expect(copy?.disabled).toBe(true);

    await act(async () => {
      copy?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(writeText).not.toHaveBeenCalled();

    release();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(copy?.disabled).toBe(false);
    await act(async () => {
      copy?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(writeText).toHaveBeenCalledWith(expectedBody);

    await act(async () => root.unmount());
  });
});
