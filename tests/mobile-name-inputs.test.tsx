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

describe("name inputs on mobile", () => {
  it("disable autocapitalize, autocorrect and spellcheck", async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const check = (input: HTMLInputElement | null, selector: string): void => {
      expect(input, selector).not.toBeNull();
      expect(input?.getAttribute("autocapitalize"), selector).toBe("none");
      expect(input?.getAttribute("autocorrect"), selector).toBe("off");
      expect(input?.getAttribute("spellcheck"), selector).toBe("false");
    };

    // The tag editor appears once "+ tag" is pressed.
    const addTag = [...viewEl.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "+ tag",
    );
    await act(async () => {
      addTag?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    check(viewEl.querySelector<HTMLInputElement>('input[aria-label="Edit tags"]'), "tags");

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="New collection"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    check(
      viewEl.querySelector<HTMLInputElement>('input[aria-label="Collection name"]'),
      "collection",
    );
    await act(async () => root.unmount());
  });
});
