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

const note = (title: string, tags: string) =>
  `---\ntitle: ${title}\ntags: [${tags}]\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const DAY = 86_400_000;

describe("counts", () => {
  it("appear on the Recent scope and the tag chips", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
    addFile("Fragments/Recent.md", note("Recent", "work"), Date.now() - 1_000);
    addFile("Fragments/Old.md", note("Old", "work"), Date.now() - 40 * DAY);
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

    const recent = [
      ...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-navigation button"),
    ].find((button) => button.textContent?.includes("Recent"));
    expect(recent?.querySelector("small")?.textContent).toBe("1");

    const chip = [
      ...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-filter-row button"),
    ].find((button) => button.textContent?.includes("#work"));
    expect(chip?.querySelector("small")?.textContent).toBe("2");
    await act(async () => root.unmount());
  });
});
