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

describe("star toggle", () => {
  it("nets out to unstarred when clicked twice before the first write lands", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    // Hold the frontmatter write so both clicks read the same rendered state.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fileManager = app.fileManager as unknown as {
      processFrontMatter: (
        file: unknown,
        fn: (data: Record<string, unknown>) => void,
      ) => Promise<void>;
    };
    const original = fileManager.processFrontMatter;
    let writes = 0;
    fileManager.processFrontMatter = async (file, fn) => {
      writes += 1;
      await gate;
      await original(file, fn);
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
    });

    const star = viewEl.querySelector<HTMLButtonElement>('button[aria-label="Star fragment"]');
    expect(star).not.toBeNull();
    await act(async () => {
      star?.click();
      star?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    release();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const text = files.get("Fragments/Note.md")?.text ?? "";
    expect(writes).toBe(2);
    // Two toggles net out: the second click must not repeat the first.
    expect(text).toMatch(/starred: false/);
    await act(async () => root.unmount());
  });
});
