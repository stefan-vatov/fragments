import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const note = `---\ntitle: Note\ntags: [work]\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("palette results", () => {
  const originalSort = Array.prototype.sort;
  afterEach(() => {
    Array.prototype.sort = originalSort;
  });

  it("are not computed while the palette is closed", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    // Only the palette sorts the fragment list; count those calls.
    let fragmentSorts = 0;
    const countSort = function (
      this: unknown[],
      comparator?: Parameters<typeof originalSort>[0],
    ): unknown[] {
      if (
        this.length > 0 &&
        this.every((item) => item && typeof item === "object" && "path" in item)
      )
        fragmentSorts += 1;
      return originalSort.call(this, comparator);
    } as typeof Array.prototype.sort;
    Array.prototype.sort = countSort;

    const { app, addFile } = createTestVault();
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
    const view = { containerEl: viewEl, contentEl: viewEl } as unknown as FragmentsView;
    const root = createRoot(viewEl);
    await act(async () => {
      root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fragmentSorts).toBe(0);

    // Typing re-renders the shell while the palette is closed.
    const editor = viewEl.querySelector<HTMLTextAreaElement>("textarea");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(editor, "Body, typed.");
      editor?.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fragmentSorts).toBe(0);

    // Opening the palette computes and sorts the list.
    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Search commands"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fragmentSorts).toBeGreaterThan(0);
    await act(async () => root.unmount());
  });
});
