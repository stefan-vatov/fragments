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

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("global search highlight", () => {
  it("clamps to the new last result when the list shrinks", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note("Alpha"), 3_000);
    addFile("Fragments/Beta.md", note("Beta"), 2_000);
    addFile("Fragments/Gamma.md", note("Gamma"), 1_000);
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

    const search = viewEl.querySelector<HTMLInputElement>(
      'input[aria-label="Search all fragments by title or tag"]',
    );
    expect(search).not.toBeNull();
    await act(async () => {
      (search as HTMLInputElement).focus();
      type(search as HTMLInputElement, "a");
      (search as HTMLInputElement).dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
      (search as HTMLInputElement).dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    // Alpha stays selected so the evidence is Enter's target, not auto-select.
    expect(
      viewEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]')?.value,
    ).toBe("Alpha");

    // The highlighted result disappears while the dropdown is still open.
    await act(async () => {
      files.delete("Fragments/Gamma.md");
      await library.load();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      (search as HTMLInputElement).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(
      viewEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]')?.value,
    ).toBe("Beta");
    await act(async () => root.unmount());
  });
});
