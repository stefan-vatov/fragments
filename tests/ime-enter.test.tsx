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

const compositionEnter = (element: Element): void => {
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true }),
  );
};

const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const mount = async () => {
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
  return { root, viewEl, library };
};

describe("enter during an IME composition", () => {
  it("does not blur the title field", async () => {
    const { root, viewEl } = await mount();
    const input = viewEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]');
    await act(async () => {
      (input as HTMLInputElement).focus();
      type(input as HTMLInputElement, "Note edited");
      compositionEnter(input as HTMLInputElement);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.activeElement).toBe(input);
    await act(async () => root.unmount());
  });

  it("does not close the command palette", async () => {
    const { root, viewEl } = await mount();
    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Search commands"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const input = viewEl.querySelector<HTMLInputElement>(
      'input[aria-label="Search commands and snippets"]',
    );
    await act(async () => {
      compositionEnter(input as HTMLInputElement);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(viewEl.querySelector(".fragments-palette")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("does not submit the collection dialog", async () => {
    const { root, viewEl } = await mount();
    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="New collection"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const input = viewEl.querySelector<HTMLInputElement>('input[aria-label="Collection name"]');
    await act(async () => {
      type(input as HTMLInputElement, "Notes");
      compositionEnter(input as HTMLInputElement);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(viewEl.querySelector('input[aria-label="Collection name"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
