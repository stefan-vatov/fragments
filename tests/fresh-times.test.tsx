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

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const DAY = 86_400_000;
const START = Date.parse("2026-01-01T00:00:00Z");

describe("time-dependent rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(START));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes relative times and the Recent scope while open", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, addFile } = createTestVault();
    addFile("Fragments/Fresh.md", note("Fresh"), START);
    addFile("Fragments/Old.md", note("Old"), START - 29.5 * DAY);

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

    const row = (name: string): HTMLElement | undefined =>
      [...viewEl.querySelectorAll<HTMLElement>(".fragments-result")].find(
        (button) => button.querySelector(".fragments-result-name")?.textContent === name,
      );
    expect(row("Fresh")?.querySelector("time")?.textContent).toBe("0m ago");

    // Recent holds both notes inside the 30-day window.
    const recent = [
      ...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-navigation button"),
    ].find((button) => button.textContent?.includes("Recent"));
    await act(async () => {
      recent?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(viewEl.querySelectorAll(".fragments-result").length).toBe(2);

    // Two hours later the label must have moved on by itself.
    await act(async () => {
      vi.setSystemTime(new Date(START + 2 * 3_600_000));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(row("Fresh")?.querySelector("time")?.textContent).toBe("2h ago");
    expect(viewEl.querySelectorAll(".fragments-result").length).toBe(2);

    // A day later the 29.5-day-old note falls out of Recent without any input.
    await act(async () => {
      vi.setSystemTime(new Date(START + DAY + 2 * 3_600_000));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(viewEl.querySelectorAll(".fragments-result").length).toBe(1);
    await act(async () => root.unmount());
  });
});
