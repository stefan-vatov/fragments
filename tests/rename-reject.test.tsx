import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app";
import { FragmentLibrary } from "../src/library";
import type FragmentsPlugin from "../src/main";
import type { FragmentsView } from "../src/view";
import { notices } from "./obsidian-stub";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body.\n`;

const titleInput = (host: HTMLElement): HTMLInputElement | null =>
  host.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]');

const setTitle = async (input: HTMLInputElement, value: string): Promise<void> => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, value);
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe("rejected rename", () => {
  it("restores the title input when the rename is refused", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    notices.length = 0;

    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note("Alpha"), 2_000);
    addFile("Fragments/Beta.md", note("Beta"), 1_000);

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

    const input = titleInput(host);
    expect(input?.value).toBe("Alpha");

    await setTitle(input!, "_fragments-scratchpad");

    expect(titleInput(host)?.value).toBe("Alpha");
    expect(notices).toContain("That title is reserved for the scratchpad.");
    expect(files.get("Fragments/Alpha.md")?.text).toContain('title: "Alpha"');
    expect(files.get("Fragments/Beta.md")?.text).toContain('title: "Beta"');
  });
});
