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
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body\n`;

const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("keyboard navigation in the list", () => {
  it("moves the selection with the arrow, Home and End keys", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
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
      await tick(20);
    });

    const rows = (): HTMLButtonElement[] => [
      ...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-result"),
    ];
    const press = async (key: string): Promise<void> => {
      await act(async () => {
        (document.activeElement as HTMLElement | null)?.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
        await tick(40);
      });
    };

    await act(async () => {
      rows()[0]?.focus();
      rows()[0]?.click();
      await tick(20);
    });
    expect(rows()[0]?.getAttribute("aria-selected")).toBe("true");

    await press("ArrowDown");
    expect(rows()[1]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(rows()[1]);

    await press("End");
    expect(rows()[2]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(rows()[2]);

    await press("Home");
    expect(rows()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(rows()[0]);
    await act(async () => root.unmount());
  });
});
