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

const note = (starred: boolean) =>
  `---\ntitle: Note\ntags: []\nstarred: ${starred}\nlanguage: "plaintext"\n---\n\nBody.\n`;
const tick = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("star intent", () => {
  it("applies an external starred change before the next click", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    const file = addFile("Fragments/Note.md", note(false), 1_000);
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
      await tick();
    });

    const starButton = (label: string): HTMLButtonElement | null =>
      viewEl.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

    // The user stars the fragment; the write lands and the library reflects it.
    await act(async () => {
      starButton("Star fragment")?.click();
      await tick(80);
    });
    expect(files.get("Fragments/Note.md")?.text).toContain("starred: true");
    expect(starButton("Unstar fragment")).not.toBeNull();

    // Another client unstars it; the library re-reads the file.
    await act(async () => {
      const entry = files.get("Fragments/Note.md");
      if (!entry) throw new Error("missing file");
      entry.text = note(false);
      await library.refresh(entry.file);
      await tick(80);
    });
    expect(starButton("Star fragment")).not.toBeNull();

    // The first click after the external change must star it again.
    await act(async () => {
      starButton("Star fragment")?.click();
      await tick(80);
    });
    expect(files.get("Fragments/Note.md")?.text).toContain("starred: true");
    await act(async () => root.unmount());
  });
});
