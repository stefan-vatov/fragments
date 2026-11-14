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

const work = `---\ntitle: Work note\ntags: [work]\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;
const other = `---\ntitle: Other note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("picking a global result", () => {
  it("keeps the list's tag filter and query", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
    addFile("Fragments/Work note.md", work, 1_000);
    addFile("Fragments/Other note.md", other, 2_000);
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

    const chip = (): HTMLButtonElement | undefined =>
      [...viewEl.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
        button.textContent?.startsWith("#work"),
      );
    await act(async () => {
      chip()?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(viewEl.querySelectorAll(".fragments-result").length).toBe(1);

    const search = viewEl.querySelector<HTMLInputElement>(
      'input[aria-label="Search all fragments by title or tag"]',
    );
    await act(async () => {
      search?.focus();
      type(search as HTMLInputElement, "Other");
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const option = viewEl.querySelector<HTMLElement>("#fragments-global-result-0");
    expect(option).not.toBeNull();
    await act(async () => {
      option?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(
      viewEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]')?.value,
    ).toBe("Other note");
    expect(chip()?.getAttribute("aria-current")).toBe("true");
    expect(viewEl.querySelectorAll(".fragments-result").length).toBe(1);
    await act(async () => root.unmount());
  });
});
