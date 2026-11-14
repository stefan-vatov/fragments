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

const type = (input: HTMLTextAreaElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("draft reads", () => {
  it("does not re-read the body after our own save or a star toggle", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, vault, files, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);
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
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    // Obsidian bumps the file's mtime on every write, which is what makes the
    // library emit a new `modified` value; the stub must do the same.
    const bumpMtime = (): void => {
      for (const entry of files.values()) entry.file.stat.mtime += 1_000;
    };
    const originalProcess = vault.process;
    vault.process = async (file, fn) => {
      const text = await originalProcess(file, fn);
      bumpMtime();
      return text;
    };
    const fileManager = app.fileManager as unknown as {
      processFrontMatter: typeof app.fileManager.processFrontMatter;
    };
    const originalFrontmatter = fileManager.processFrontMatter;
    fileManager.processFrontMatter = async (file, fn) => {
      await originalFrontmatter(file, fn);
      bumpMtime();
    };

    let reads = 0;
    const original = vault.cachedRead;
    vault.cachedRead = async (file) => {
      reads += 1;
      return original(file);
    };

    const editor = viewEl.querySelector<HTMLTextAreaElement>("textarea");
    expect(editor).not.toBeNull();
    await act(async () => {
      type(editor as HTMLTextAreaElement, "Body, edited.");
      await new Promise((resolve) => setTimeout(resolve, 900));
    });
    // One read indexes the saved body; the draft effect must not read it again.
    expect(reads).toBe(1);

    reads = 0;
    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Star fragment"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    // The body did not change, so only the index pass reads it.
    expect(reads).toBe(1);
    await act(async () => root.unmount());
  });
});
