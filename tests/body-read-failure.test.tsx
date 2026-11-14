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

describe("a failed body read", () => {
  it("shows an error state with a retry that loads the fragment", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, vault, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const original = vault.cachedRead;
    let failing = true;
    vault.cachedRead = async (file) => {
      if (failing) {
        failing = false;
        throw new Error("permission denied");
      }
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
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const error = viewEl.querySelector<HTMLElement>(".fragments-read-error");
    expect(error).not.toBeNull();
    expect(error?.textContent ?? "").toContain("could not be loaded");

    const retry = [...viewEl.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Retry",
    );
    expect(retry).not.toBeUndefined();
    await act(async () => {
      retry?.click();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    const editor = viewEl.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Fragment text"]',
    );
    expect(editor).not.toBeNull();
    expect(editor?.readOnly).toBe(false);
    expect(editor?.value ?? "").toContain("Body.");
    await act(async () => root.unmount());
  });
});
