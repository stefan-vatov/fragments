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

const note = (index: number) =>
  `---\ntitle: Note ${index}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody ${index}.\n`;

const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("the fragment list", () => {
  it("returns to the top when the filter changes", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
    for (let index = 1; index <= 30; index++) {
      addFile(`Fragments/Note ${index}.md`, note(index), 1_000 + index);
    }
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

    const viewport = viewEl.querySelector<HTMLElement>(".fragments-results");
    expect(viewport).not.toBeNull();
    await act(async () => {
      (viewport as HTMLElement).scrollTop = 400;
      viewport?.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect((viewport as HTMLElement).scrollTop).toBe(400);

    const search = viewEl.querySelector<HTMLInputElement>('input[aria-label="Search fragments"]');
    await act(async () => {
      type(search as HTMLInputElement, "note");
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect((viewport as HTMLElement).scrollTop).toBe(0);
    await act(async () => root.unmount());
  });
});
