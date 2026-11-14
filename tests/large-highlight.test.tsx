import { act } from "react";
import { createRoot } from "react-dom/client";
import hljs from "highlight.js";
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

const body = "const value = 1;\n".repeat(1_200) + "const tail = 2;\n";

const type = (input: HTMLTextAreaElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("large fragments", () => {
  it("are still syntax highlighted", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    expect(body.length).toBeGreaterThan(20_000);
    const highlight = vi.spyOn(hljs, "highlightElement").mockImplementation(() => undefined);

    const { app, addFile } = createTestVault();
    addFile(
      "Fragments/Note.md",
      `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "javascript"\n---\n\n${body}\n`,
      1_000,
    );
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
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const editor = viewEl.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Fragment text"]',
    );
    expect(editor).not.toBeNull();
    expect(editor?.value.length).toBeGreaterThan(20_000);

    // Editing a fragment past the old 20k cap must still repaint the highlight.
    highlight.mockClear();
    await act(async () => {
      type(editor as HTMLTextAreaElement, `${body}x`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(highlight).toHaveBeenCalled();
    highlight.mockRestore();
    await act(async () => root.unmount());
  });
});
