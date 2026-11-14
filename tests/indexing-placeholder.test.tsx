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

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody text here.\n`;

describe("the list while the body index is reading", () => {
  it("says Indexing… until the body is known", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, vault, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);
    // The shell loads the library itself, so the gate may be opened more than
    // once; collect every pending resolver.
    const releases: Array<() => void> = [];
    vault.cachedRead = () =>
      new Promise<string>((resolve) => {
        releases.push(() => resolve(note));
      });

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    const loading = library.load();
    // The metadata pass emits first, then the background body read starts and
    // parks on the gate; mount only once the read is genuinely in flight.
    for (let i = 0; i < 50 && releases.length === 0; i += 1)
      await new Promise((resolve) => setTimeout(resolve, 5));

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

    const preview = (): string | null | undefined =>
      viewEl.querySelector(".fragments-result-preview")?.textContent;
    expect(preview()).toBe("Indexing…");

    await act(async () => {
      for (const release of [...releases]) release();
      await loading;
      await new Promise((resolve) => setTimeout(resolve, 30));
      for (const release of [...releases]) release();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(preview()).toContain("Body text here.");
    await act(async () => root.unmount());
  });
});
