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

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody\n`;
const padPath = "Fragments/_fragments-scratchpad.md";
const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("a conflicted scratchpad", () => {
  it("can be reloaded from the file and keeps saving afterwards", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const vault = createTestVault();
    vault.addFile("Fragments/Note.md", note, 1_000);
    vault.addFile(padPath, "Pad text", 1_000);
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

    const pad = (): HTMLTextAreaElement | null =>
      viewEl.querySelector<HTMLTextAreaElement>('textarea[aria-label="Scratchpad text"]');
    const status = (): string | null | undefined =>
      viewEl
        .querySelector(".fragments-scratchpad-header [data-status]")
        ?.getAttribute("data-status");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

    // The file changes externally, then a save fails against the stale baseline.
    await act(async () => {
      const entry = vault.files.get(padPath);
      if (!entry) throw new Error("missing pad");
      entry.text = "External text";
      (vault.vault as unknown as Record<string, unknown>).process = async () => {
        throw new Error("save rejected");
      };
      pad()?.focus();
      setter?.call(pad(), "Pad text, edited");
      pad()?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      pad()?.blur();
      await tick(100);
    });
    expect(status()).toBe("error");

    // The reload affordance re-reads the file and rebaselines the session.
    (vault.vault as unknown as Record<string, unknown>).process = async (
      file: unknown,
      fn: (source: string) => string,
    ) => {
      const entry = vault.files.get((file as { path: string }).path);
      if (!entry) throw new Error("missing file");
      entry.text = fn(entry.text);
      return entry.text;
    };
    const reload = viewEl.querySelector<HTMLButtonElement>(
      'button[aria-label="Reload scratchpad"]',
    );
    expect(reload).not.toBeNull();
    await act(async () => {
      reload?.click();
      await tick(60);
    });
    expect(pad()?.value).toBe("External text");
    expect(status()).toBe("saved");

    await act(async () => {
      pad()?.focus();
      setter?.call(pad(), "External text plus");
      pad()?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      pad()?.blur();
      await tick(100);
    });
    expect(vault.files.get(padPath)?.text).toBe("External text plus");
    await act(async () => root.unmount());
  });
});
