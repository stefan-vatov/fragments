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

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("actions in a popout window", () => {
  it("copies and confirms through the view's own window", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const ambientWrite = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: ambientWrite },
      configurable: true,
    });
    const ambientConfirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const popoutWrite = vi.fn(async () => undefined);
    const popoutConfirm = vi.fn(() => true);
    const popout = { navigator: { clipboard: { writeText: popoutWrite } }, confirm: popoutConfirm };

    const { app, files, trashed, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    const plugin = {
      app,
      library,
      settings: { folder: "Fragments", snippetFont: "monospace", customSnippetFont: "" },
      subscribeSettings: () => () => undefined,
      settingsSnapshot: () => 0,
    } as unknown as FragmentsPlugin;
    const viewEl = document.createElement("div");
    document.body.append(viewEl);
    // The app only asks the container for its document (listeners, the view's
    // window) and whether it contains an event target.
    const popoutDocument = {
      defaultView: popout,
      addEventListener: document.addEventListener.bind(document),
      removeEventListener: document.removeEventListener.bind(document),
    };
    const containerEl = {
      ownerDocument: popoutDocument,
      contains: (target: Node) => viewEl.contains(target),
    };
    const view = { containerEl, contentEl: viewEl } as unknown as FragmentsView;
    const root = createRoot(viewEl);
    await act(async () => {
      root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Copy fragment"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(popoutWrite).toHaveBeenCalledWith("Body.\n");
    expect(ambientWrite).not.toHaveBeenCalled();

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Move to trash"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(popoutConfirm).toHaveBeenCalled();
    expect(ambientConfirm).not.toHaveBeenCalled();
    expect(files.has("Fragments/Note.md")).toBe(false);
    expect(trashed.has("Fragments/Note.md")).toBe(true);

    ambientConfirm.mockRestore();
    await act(async () => root.unmount());
  });
});
