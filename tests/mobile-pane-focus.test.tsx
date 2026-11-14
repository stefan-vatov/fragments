import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const note = (title: string, starred = false) =>
  `---\ntitle: ${title}\ntags: []\nstarred: ${starred}\nlanguage: "plaintext"\n---\n\n${title} body\n`;

const tick = (ms = 20): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("mobile pane focus", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    // jsdom has no matchMedia; emulate a narrow viewport.
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    // @ts-expect-error -- jsdom starts without matchMedia.
    delete window.matchMedia;
  });

  it("moves focus into the pane that is shown", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note("Alpha"), 2_000);
    addFile("Fragments/Beta.md", note("Beta", true), 1_000);
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

    const button = (label: string): HTMLButtonElement | undefined =>
      [...viewEl.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
        item.textContent?.includes(label),
      );

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>(".fragments-result")?.click();
      await tick();
    });
    expect(document.activeElement).toBe(viewEl.querySelector('input[aria-label="Fragment title"]'));

    await act(async () => {
      viewEl
        .querySelector<HTMLButtonElement>('button[aria-label="Back to fragment list"]')
        ?.click();
      await tick();
    });
    expect(document.activeElement).toBe(viewEl.querySelector(".fragments-result.is-selected"));

    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]')?.click();
      await tick();
    });
    expect(document.activeElement).toBe(viewEl.querySelector(".fragments-navigation button"));

    await act(async () => {
      button("Starred")?.click();
      await tick();
    });
    expect(document.activeElement).toBe(
      viewEl.querySelector('input[aria-label="Search fragments"]'),
    );
    await act(async () => root.unmount());
  });
});
