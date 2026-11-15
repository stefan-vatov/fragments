import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "../src/app";
import { FragmentLibrary } from "../src/library";
import type FragmentsPlugin from "../src/main";
import type { FragmentsView } from "../src/view";
import { MarkdownRenderer } from "./obsidian-stub";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "markdown"\n---\n\n# Heading\n`;
const tick = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const originalRender = MarkdownRenderer.render;

afterEach(() => {
  MarkdownRenderer.render = originalRender;
});

describe("a markdown preview that fails to render", () => {
  it("shows an error instead of a blank pane", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const vault = createTestVault();
    vault.addFile("Fragments/Alpha.md", note, 1_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();
    const plugin = {
      app: vault.app,
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

    MarkdownRenderer.render = async () => {
      throw new Error("post-processor exploded");
    };
    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Preview fragment"]')?.click();
      await tick(120);
    });

    const error = viewEl.querySelector(".fragments-preview-error");
    expect(error?.textContent).toContain("could not be previewed");
    await act(async () => root.unmount());
  });
});
