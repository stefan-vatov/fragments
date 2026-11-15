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

async function mount() {
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
  return { vault, root, viewEl };
}

describe("scratchpad save recovery", () => {
  it("retries a temporary write failure without discarding the local text", async () => {
    const { vault, root, viewEl } = await mount();
    const originalProcess = vault.vault.process;
    vault.vault.process = async () => {
      throw new Error("temporary sync lock");
    };
    const pad = viewEl.querySelector<HTMLTextAreaElement>('[aria-label="Scratchpad text"]')!;
    try {
      await act(async () => {
        pad.focus();
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
          pad,
          "Local text kept through the failure",
        );
        pad.dispatchEvent(new Event("input", { bubbles: true }));
        pad.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
        await tick();
      });
      expect(viewEl.querySelector("[data-status]")?.getAttribute("data-status")).toBe("error");
      expect(pad.value).toBe("Local text kept through the failure");
      expect(vault.files.get(padPath)?.text).toBe("Pad text");
      vault.vault.process = originalProcess;
      await act(async () => {
        pad.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
        await tick();
      });
      expect(vault.files.get(padPath)?.text).toBe("Local text kept through the failure");
      expect(pad.value).toBe("Local text kept through the failure");
      expect(viewEl.querySelector("[data-status]")?.getAttribute("data-status")).toBe("saved");
    } finally {
      vault.vault.process = originalProcess;
      await act(async () => root.unmount());
      viewEl.remove();
    }
  });

  it("reloads a conflict with one pointer click and keeps saving afterwards", async () => {
    const { vault, root, viewEl } = await mount();
    let resume = (): void => undefined;
    try {
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
        pad()?.focus();
        setter?.call(pad(), "Pad text, edited");
        pad()?.dispatchEvent(new Event("input", { bubbles: true }));
        await tick();
        pad()?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
        );
        await tick(100);
      });
      expect(status()).toBe("error");

      expect(document.activeElement).toBe(pad());
      expect(vault.files.get(padPath)?.text).toBe("External text");
      await act(async () => {
        setter?.call(pad(), "Pad text, still editing");
        pad()?.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(status()).toBe("error");
      expect(vault.files.get(padPath)?.text).toBe("External text");

      const gate = new Promise<void>((resolve) => (resume = resolve));
      const originalProcess = vault.vault.process;
      vault.vault.process = async (...args) => {
        await gate;
        return originalProcess(...args);
      };

      // A pointer press moves focus before its click. The textarea's blur must
      // not remove the Reload button between those two events.
      const reload = viewEl.querySelector<HTMLButtonElement>(
        'button[aria-label="Reload scratchpad"]',
      );
      expect(reload).not.toBeNull();
      await act(async () => {
        reload?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        reload?.focus();
        await tick();
      });
      await act(async () => {
        reload?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        reload?.click();
        resume();
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
    } finally {
      resume();
      await act(async () => root.unmount());
      viewEl.remove();
    }
  });
});
