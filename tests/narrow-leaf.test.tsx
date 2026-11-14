import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app";
import { FragmentLibrary } from "../src/library";
import type FragmentsPlugin from "../src/main";
import type { FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ResizeCallback = (entries: Array<{ contentRect: { width: number } }>) => void;

let observer: ResizeCallback | undefined;

class CapturingResizeObserver {
  constructor(callback: ResizeCallback) {
    observer = callback;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const tick = (ms = 20): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("a narrow leaf in a wide window", () => {
  it("marks the app narrow from the observed container width", async () => {
    globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
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
    Object.defineProperty(viewEl, "clientWidth", { value: 400, configurable: true });
    document.body.append(viewEl);
    const view = { containerEl: viewEl, contentEl: viewEl } as unknown as FragmentsView;
    const root = createRoot(viewEl);
    await act(async () => {
      root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
      await tick();
    });

    const classNames = (): string | null | undefined =>
      viewEl.querySelector(".fragments-app")?.getAttribute("data-narrow");
    expect(classNames()).toBe("true");

    await act(async () => {
      observer?.([{ contentRect: { width: 1_200 } }]);
      await tick();
    });
    expect(classNames()).toBeNull();
    await act(async () => root.unmount());
  });
});
