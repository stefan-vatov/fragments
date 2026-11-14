import { act } from "react";
import { createRoot } from "react-dom/client";
import { MarkdownRenderer } from "obsidian";
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

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "markdown"\n---\n\n# ${title}\n`;

describe("markdown preview", () => {
  it("renders against a disposable component and unloads it", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const render = vi.spyOn(MarkdownRenderer, "render");

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
    });

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Preview fragment"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(render).toHaveBeenCalled();

    const component = render.mock.calls[0]?.[4] as { unloaded?: boolean } | undefined;
    // The ItemView outlives every preview; rendered embeds must not attach to it.
    expect(component).not.toBe(view);

    // Switching fragments ends the effect: the component must be unloaded.
    const other = [...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-result")].find(
      (button) => button.querySelector(".fragments-result-name")?.textContent === "Beta",
    );
    await act(async () => {
      other?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(component?.unloaded).toBe(true);
    render.mockRestore();
    await act(async () => root.unmount());
  });
});
