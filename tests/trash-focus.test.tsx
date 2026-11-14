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

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("trashing the selected fragment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves focus to the new selection instead of dropping it", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note("Alpha"), 2_000);
    addFile("Fragments/Beta.md", note("Beta"), 1_000);
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

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Move to trash"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });

    const title = viewEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]');
    expect(title?.value).toBe("Beta");
    expect(document.activeElement).toBe(title);
    await act(async () => root.unmount());
  });
});
