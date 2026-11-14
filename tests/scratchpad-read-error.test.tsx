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

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const mount = async (seed: (vault: ReturnType<typeof createTestVault>) => void) => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const vault = createTestVault();
  seed(vault);
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
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return { root, viewEl };
};

describe("scratchpad after a read error", () => {
  it("keeps what the user types instead of silently discarding it", async () => {
    const { root, viewEl } = await mount((vault) => {
      vault.addFile("Fragments/Note.md", note, 1_000);
      // The pad path resolves to a folder, so readScratchpad() rejects.
      void vault.vault.createFolder("Fragments/_fragments-scratchpad.md");
    });

    const textarea = viewEl.querySelector<HTMLTextAreaElement>(".fragments-scratchpad-editor");
    expect(textarea).not.toBeNull();
    expect(textarea?.disabled).toBe(false);

    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(textarea, "typed text");
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // Before the fix every keystroke was reverted because the session never
    // became ready after the failed read.
    expect((textarea as HTMLTextAreaElement).value).toBe("typed text");
    await act(async () => root.unmount());
  });
});
