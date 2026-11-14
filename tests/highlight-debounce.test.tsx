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

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "javascript"\n---\n\nconst a = 1;\n`;

const type = (input: HTMLTextAreaElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("syntax highlighting", () => {
  it("waits for a pause instead of re-tokenising on every keystroke", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const highlight = vi.spyOn(hljs, "highlightElement").mockImplementation(() => undefined);

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
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    highlight.mockClear();

    const editor = viewEl.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Fragment text"]',
    );
    expect(editor).not.toBeNull();
    await act(async () => {
      type(editor as HTMLTextAreaElement, "const a = 12;");
      await new Promise((resolve) => setTimeout(resolve, 5));
      type(editor as HTMLTextAreaElement, "const a = 123;");
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    // Nothing yet: two keystrokes in a row must not tokenise twice.
    expect(highlight).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(highlight).toHaveBeenCalledTimes(1);
    highlight.mockRestore();
    await act(async () => root.unmount());
  });
});
