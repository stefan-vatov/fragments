import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
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

const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("list search", () => {
  it("offers a clear button once a query is typed", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
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
    });

    const input = viewEl.querySelector<HTMLInputElement>('input[aria-label="Search fragments"]');
    expect(input).not.toBeNull();
    await act(async () => {
      type(input as HTMLInputElement, "note");
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect((input as HTMLInputElement).value).toBe("note");

    const clear = viewEl.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]');
    expect(clear).not.toBeNull();
    await act(async () => {
      clear?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect((input as HTMLInputElement).value).toBe("");
    await act(async () => root.unmount());
  });
});
