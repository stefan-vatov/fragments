import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
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

const note = (title: string, body: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;
const tick = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("deleting the open fragment externally", () => {
  it("keeps the unsaved draft recoverable", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const vault = createTestVault();
    vault.addFile("Fragments/A.md", note("Alpha", "Alpha body"), 1_000);
    vault.addFile("Fragments/B.md", note("Beta", "Beta body"), 2_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();
    const plugin = {
      app: vault.app,
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

    const editor = (): HTMLTextAreaElement | null =>
      viewEl.querySelector<HTMLTextAreaElement>(".fragments-editor");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      [...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-result")]
        .find((button) => button.textContent?.includes("Alpha"))
        ?.click();
      await tick();
    });
    await act(async () => {
      setter?.call(editor(), "Draft text");
      editor()?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });

    await act(async () => {
      vault.files.delete("Fragments/A.md");
      library.remove("Fragments/A.md");
      await tick(120);
    });

    const recovered = viewEl.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Recovered draft"]',
    );
    expect(recovered?.value).toBe("Draft text");

    const copied: string[] = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: async (text: string) => {
          copied.push(text);
        },
      },
    });
    const copy = [...viewEl.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Copy draft",
    );
    await act(async () => {
      copy?.click();
      await tick();
    });
    expect(copied).toEqual(["Draft text"]);

    const dismiss = [...viewEl.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Dismiss",
    );
    await act(async () => {
      dismiss?.click();
      await tick();
    });
    expect(viewEl.querySelector('textarea[aria-label="Recovered draft"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
