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
const tick = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("the new-collection dialog", () => {
  it("creates one collection when the form is submitted twice", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    let calls = 0;
    const original = library.createCollection.bind(library);
    library.createCollection = async (name: string) => {
      calls += 1;
      return original(name);
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
      await tick();
    });

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="New collection"]')?.click();
      await tick();
    });
    const input = viewEl.querySelector<HTMLInputElement>('input[aria-label="Collection name"]');
    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "Studio");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });

    const form = input?.form;
    expect(form).not.toBeNull();
    await act(async () => {
      form?.requestSubmit();
      form?.requestSubmit();
      await tick(120);
    });
    expect(calls).toBe(1);
    expect(app.vault.getAbstractFileByPath("Fragments/Studio")).not.toBeNull();
    await act(async () => root.unmount());
  });
});
