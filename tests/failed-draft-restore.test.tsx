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

const alpha = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nAlpha body\n`;
const beta = `---\ntitle: Beta\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBeta body\n`;

const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("a failed draft save", () => {
  it("keeps the typed text when switching away and back", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, vault, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", alpha, 1_000);
    addFile("Fragments/Beta.md", beta, 2_000);
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
      await tick(20);
    });

    const row = (title: string): HTMLButtonElement | undefined =>
      [...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-result")].find((button) =>
        button.textContent?.includes(title),
      );
    const editor = (): HTMLTextAreaElement | null =>
      viewEl.querySelector<HTMLTextAreaElement>(".fragments-editor");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

    await act(async () => {
      row("Alpha")?.click();
      await tick(20);
    });
    expect(editor()?.value).toContain("Alpha body");

    await act(async () => {
      setter?.call(editor(), "Draft text");
      editor()?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick(20);
    });

    // The save fails while switching away.
    (vault as unknown as Record<string, unknown>).process = async () => {
      throw new Error("disk full");
    };
    await act(async () => {
      row("Beta")?.click();
      await tick(40);
    });
    expect(editor()?.value).toContain("Beta body");

    await act(async () => {
      row("Alpha")?.click();
      await tick(40);
    });
    expect(editor()?.value).toBe("Draft text");
    await act(async () => root.unmount());
  });
});
