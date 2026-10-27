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

const titleInput = (host: HTMLElement): HTMLInputElement => {
  const input = host.querySelector<HTMLInputElement>('[aria-label="Fragment title"]');
  if (!input) throw new Error("Missing title input");
  return input;
};

const renameByBlur = (input: HTMLInputElement, value: string): void => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
};

async function mount() {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const { app, files, addFile } = createTestVault();
  addFile(
    "Fragments/Untitled fragment.md",
    '---\ntitle: "Untitled fragment"\ntags: []\n---\n\nFirst fragment body.\n',
    1000,
  );
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  const plugin = {
    app,
    library,
    settings: { folder: "Fragments", snippetFont: "monospace", customSnippetFont: "" },
    subscribeSettings: () => () => undefined,
    settingsSnapshot: () => 0,
  } as unknown as FragmentsPlugin;
  const host = document.createElement("div");
  document.body.append(host);
  const view = { containerEl: host, contentEl: host } as unknown as FragmentsView;
  const root = createRoot(host);
  await act(async () => {
    root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
  });
  return { app, files, host, root };
}

describe("renaming a reused untitled filename", () => {
  it("keeps queued renames attached to their own files while the first title is saving", async () => {
    const { app, files, host, root } = await mount();

    let resumeWrite!: () => void;
    let signalStarted!: () => void;
    const writeGate = new Promise<void>((resolve) => (resumeWrite = resolve));
    const writeStarted = new Promise<void>((resolve) => (signalStarted = resolve));
    const originalWrite = app.fileManager.processFrontMatter.bind(app.fileManager);
    let firstWrite = true;
    app.fileManager.processFrontMatter = async (...args) => {
      if (firstWrite) {
        firstWrite = false;
        signalStarted();
        await writeGate;
      }
      return originalWrite(...args);
    };

    try {
      expect(titleInput(host).value).toBe("Untitled fragment");

      await act(async () => {
        renameByBlur(titleInput(host), "First note");
        await writeStarted;
      });
      expect(titleInput(host).value).toBe("First note");
      expect(files.has("Fragments/First note.md")).toBe(true);

      await act(async () => {
        host.querySelector<HTMLButtonElement>(".fragments-new")!.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(files.has("Fragments/Untitled fragment.md")).toBe(false);
      await act(async () => {
        resumeWrite();
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(titleInput(host).value).toBe("Untitled fragment");
      expect(files.has("Fragments/Untitled fragment.md")).toBe(true);

      await act(async () => {
        renameByBlur(titleInput(host), "Second note");
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(files.get("Fragments/First note.md")?.text).toContain("First fragment body.");
      expect(files.get("Fragments/First note.md")?.text).toContain('title: "First note"');
      expect(files.get("Fragments/Second note.md")?.text).toContain('title: "Second note"');
      expect(files.get("Fragments/Second note.md")?.text).not.toContain("First fragment body.");
      expect(titleInput(host).value).toBe("Second note");
    } finally {
      resumeWrite();
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("renames a new untitled fragment without touching the earlier named fragment", async () => {
    const { files, host, root } = await mount();
    try {
      await act(async () => {
        renameByBlur(titleInput(host), "First note");
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(titleInput(host).value).toBe("First note");
      const first = files.get("Fragments/First note.md")?.text;
      expect(first).toContain("First fragment body.");

      await act(async () => {
        host.querySelector<HTMLButtonElement>(".fragments-new")!.click();
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(titleInput(host).value).toBe("Untitled fragment");
      await act(async () => {
        renameByBlur(titleInput(host), "Second note");
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(files.get("Fragments/First note.md")?.text).toBe(first);
      expect(files.get("Fragments/Second note.md")?.text).toContain('title: "Second note"');
      expect(files.get("Fragments/Second note.md")?.text).not.toContain("First fragment body.");
      expect(titleInput(host).value).toBe("Second note");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("applies a queued star to the same fragment after its rename finishes", async () => {
    const { app, files, host, root } = await mount();
    let resumeWrite!: () => void;
    let signalStarted!: () => void;
    const writeGate = new Promise<void>((resolve) => (resumeWrite = resolve));
    const writeStarted = new Promise<void>((resolve) => (signalStarted = resolve));
    const originalWrite = app.fileManager.processFrontMatter.bind(app.fileManager);
    let firstWrite = true;
    app.fileManager.processFrontMatter = async (...args) => {
      if (firstWrite) {
        firstWrite = false;
        signalStarted();
        await writeGate;
      }
      return originalWrite(...args);
    };
    try {
      await act(async () => {
        renameByBlur(titleInput(host), "First note");
        await writeStarted;
      });
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[aria-label="Star fragment"]')!.click();
        resumeWrite();
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(files.get("Fragments/First note.md")?.text).toContain("starred: true");
      expect(files.get("Fragments/First note.md")?.text).toContain("First fragment body.");
      expect(titleInput(host).value).toBe("First note");
    } finally {
      resumeWrite();
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
