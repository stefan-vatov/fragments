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
const MODIFIED = Date.parse("2026-01-01T00:00:00Z");

describe("list timestamps", () => {
  it("carry a machine-readable date and an absolute title", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, MODIFIED);
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

    const time = viewEl.querySelector<HTMLTimeElement>(".fragments-result time");
    expect(time).not.toBeNull();
    expect(time?.getAttribute("dateTime")).toBe("2026-01-01T00:00:00.000Z");
    expect(time?.getAttribute("title") ?? "").not.toBe("");
    expect(time?.getAttribute("title") ?? "").not.toBe(time?.textContent);
    await act(async () => root.unmount());
  });
});
