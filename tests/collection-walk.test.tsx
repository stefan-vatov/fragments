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

describe("collection list", () => {
  it("walks the folder tree once per revision", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, vault, addFile } = createTestVault();
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
    const probe = vi.spyOn(vault, "getAbstractFileByPath");
    await act(async () => {
      root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const walks = (): number => probe.mock.calls.filter(([path]) => path === "Fragments").length;
    const baseline = walks();

    // Typing re-renders the editor, the sidebar and the collection <select>
    // without changing the folder tree: no walk may happen.
    const editor = viewEl.querySelector<HTMLTextAreaElement>("textarea");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(editor, "Body, typed.");
      editor?.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(walks() - baseline).toBe(0);

    // A new collection still appears: creating it invalidates the cache.
    await act(async () => {
      await library.createCollection("Projects");
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const names = [...viewEl.querySelectorAll(".fragments-navigation button")].map(
      (button) => button.textContent ?? "",
    );
    expect(names.some((text) => text.includes("Projects"))).toBe(true);
    probe.mockRestore();
    await act(async () => root.unmount());
  });
});
