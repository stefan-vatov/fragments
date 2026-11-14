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

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nold body\n`;

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
  return { root, viewEl, library, vault };
};

const wait = async (ms: number): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

const typeBody = async (host: HTMLElement, value: string): Promise<void> => {
  const editor = host.querySelector<HTMLTextAreaElement>(".fragments-editor");
  expect(editor).not.toBeNull();
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(editor, value);
    editor?.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("autosave after a transient failure", () => {
  it("retries on its own instead of stranding the draft until the next keystroke", async () => {
    let calls = 0;
    const { root, viewEl, vault } = await mount((vault) => {
      vault.addFile("Fragments/Note.md", note, 1_000);
      const original = vault.vault.process;
      // First write fails like a sync lock or a transient disk error.
      vault.vault.process = async (file, fn) => {
        calls++;
        if (calls === 1) throw new Error("transient write failure");
        return original(file, fn);
      };
    });

    await typeBody(viewEl, "new body");
    await wait(900); // first debounce fires and fails
    expect(vault.files.get("Fragments/Note.md")?.text).toContain("old body");

    await wait(1_400); // no further typing: the retry must persist the draft
    expect(vault.files.get("Fragments/Note.md")?.text).toContain("new body");

    await act(async () => root.unmount());
  });
});
