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

const note = (title: string, body: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;
const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("a failed draft for a replaced file", () => {
  it("does not offer the old draft for a re-created fragment", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const vault = createTestVault();
    vault.addFile("Fragments/A.md", note("Alpha", "Old body"), 1_000);
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

    const row = (title: string): HTMLButtonElement | undefined =>
      [...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-result")].find((button) =>
        button.textContent?.includes(title),
      );
    const editor = (): HTMLTextAreaElement | null =>
      viewEl.querySelector<HTMLTextAreaElement>(".fragments-editor");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

    await act(async () => {
      row("Alpha")?.click();
      await tick();
    });
    await act(async () => {
      setter?.call(editor(), "Draft text");
      editor()?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });

    (vault.vault as unknown as Record<string, unknown>).process = async () => {
      throw new Error("disk full");
    };
    await act(async () => {
      row("Beta")?.click();
      await tick(50);
    });

    await act(async () => {
      vault.files.delete("Fragments/A.md");
      library.remove("Fragments/A.md");
      const replacement = vault.addFile("Fragments/A.md", note("Alpha", "New body"), Date.now());
      await library.refresh(replacement);
      await tick();
    });

    await act(async () => {
      row("Alpha")?.click();
      await tick(50);
    });
    expect(editor()?.value).toContain("New body");
    await act(async () => root.unmount());
  });
});
