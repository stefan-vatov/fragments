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

describe("tag filter chips", () => {
  it("keeps the selected tag chip visible after it falls out of the top five", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, vault, addFile } = createTestVault();
    // "alpha" is in the short initial list, so it is one of the five chips.
    addFile("Fragments/Alpha.md", note("Alpha", "alpha"), 1_000);

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

    const chip = (text: string): HTMLButtonElement | undefined =>
      [...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-filter-row button")].find(
        (button) => button.textContent?.startsWith(text) ?? false,
      );

    await act(async () => {
      chip("#alpha")?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(chip("#alpha")?.className).toBe("active");

    // New content gives five other tags a higher count, pushing "alpha" out of
    // the top five while the filter is still applied.
    for (const tag of ["b1", "b2", "b3", "b4", "b5"]) {
      addFile(`Fragments/${tag}-one.md`, note(`${tag} one`, tag), 2_000);
      addFile(`Fragments/${tag}-two.md`, note(`${tag} two`, tag), 2_000);
    }
    await act(async () => {
      await library.load();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // The filter is still applied, so its chip must remain reachable.
    expect(chip("#alpha")?.className).toBe("active");
    await act(async () => root.unmount());
  });
});
