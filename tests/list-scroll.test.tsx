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

const note = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body.\n`;

const setInput = async (input: HTMLInputElement, value: string): Promise<void> => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe("virtual list scrolling", () => {
  it("shows matching rows after filtering from far down the list", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, addFile } = createTestVault();
    for (let index = 0; index < 30; index++)
      addFile(
        `Fragments/snip-${String(index).padStart(2, "0")}.md`,
        note(`snip-${String(index).padStart(2, "0")}`),
        1_000 + index,
      );
    for (let index = 1; index <= 3; index++)
      addFile(`Fragments/zqmarker-${index}.md`, note(`zqmarker-${index}`), 2_000 + index);

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const plugin = {
      app,
      library,
      settings: { folder: "Fragments", snippetFont: "monospace", customSnippetFont: "" },
      subscribeSettings: () => () => undefined,
      settingsSnapshot: () => 0,
    } as unknown as FragmentsPlugin;
    const view = {
      containerEl: document.body,
      contentEl: document.createElement("div"),
    } as unknown as FragmentsView;

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
    });

    const results = host.querySelector<HTMLDivElement>(".fragments-results");
    expect(results).not.toBeNull();
    expect(host.querySelectorAll(".fragments-result").length).toBeGreaterThan(0);

    await act(async () => {
      results!.scrollTop = 2_000;
      results!.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const search = host.querySelector<HTMLInputElement>('input[aria-label="Search fragments"]');
    expect(search).not.toBeNull();
    await setInput(search!, "zqmarker");

    expect(host.querySelector(".fragments-list-summary")?.textContent).toContain("3 snippets");
    expect(host.querySelectorAll(".fragments-result").length).toBe(3);
    expect(results!.scrollTop).toBe(0);
  });
});
