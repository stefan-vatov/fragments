import { act } from "react";
import { describe, expect, it } from "vitest";
import FragmentsPlugin from "../src/main";
import { FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

async function mount(path = "Fragments/Alpha.md") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();

  const { app, files, addFile } = createTestVault();
  const file = addFile(path, note, 1_000);

  const handlers: Record<string, (file: unknown, oldPath?: string) => void> = {};
  let leaf: { view?: unknown } = {};
  Object.assign(app as unknown as Record<string, unknown>, {
    workspace: {
      onLayoutReady: (callback: () => void) => callback(),
      getLeavesOfType: () => [leaf],
      detachLeavesOfType: () => undefined,
    },
  });
  (app.vault as unknown as Record<string, unknown>).on = (
    event: string,
    callback: (file: unknown, oldPath?: string) => void,
  ) => {
    handlers[event] = callback;
    return {};
  };
  (app.metadataCache as unknown as Record<string, unknown>).on = () => ({});

  const plugin = new FragmentsPlugin(app as never, {} as never);
  Object.assign(plugin, {
    loadData: async () => null,
    registerView: () => undefined,
    addSettingTab: () => undefined,
    addRibbonIcon: () => undefined,
    addCommand: () => undefined,
    registerObsidianProtocolHandler: () => undefined,
    registerEvent: () => undefined,
  });
  await plugin.onload();

  const view = new FragmentsView(leaf as never, plugin);
  leaf = { view };
  await act(async () => {
    await view.onOpen();
  });
  document.body.append(view.contentEl);

  const originalRename = app.fileManager.renameFile.bind(app.fileManager);
  app.fileManager.renameFile = async (target, next) => {
    const previous = target.path;
    await originalRename(target, next);
    // The host's vault event can arrive after renameFile has resolved and the
    // library has refreshed the moved note, before its title write completes.
    setTimeout(() => handlers.rename?.(target, previous), 0);
  };

  return { app, files, file, view, addFile, handlers, library: plugin.library };
}

describe("vault rename events in the open fragment", () => {
  it("follows an external rename outside the active collection without losing its scope", async () => {
    const { app, files, file, view, addFile, library } = await mount();
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    try {
      await act(async () => {
        const other = addFile("Fragments/Target/Beta.md", note.replace("Alpha", "Beta"), 2_000);
        await library.refresh(other);
      });
      const collection = [...view.contentEl.querySelectorAll<HTMLButtonElement>("nav button")].find(
        (button) => button.querySelector("span")?.textContent === "Target",
      )!;
      await act(async () => collection.click());
      const global = view.contentEl.querySelector<HTMLInputElement>(
        '[aria-label="Search all fragments by title or tag"]',
      )!;
      await act(async () => {
        global.focus();
        setInput.call(global, "Alpha");
        global.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () =>
        view.contentEl
          .querySelector<HTMLButtonElement>(".fragments-global-results button")!
          .click(),
      );
      await act(async () => {
        const editor = view.contentEl.querySelector<HTMLTextAreaElement>(
          '[aria-label="Fragment text"]',
        )!;
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
          editor,
          "Still editing the out-of-scope file.",
        );
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        await app.fileManager.renameFile(file, "Fragments/Alpha renamed.md");
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(files.get("Fragments/Alpha renamed.md")?.text).toContain(
        "Still editing the out-of-scope file.",
      );
      expect(
        view.contentEl.querySelector(".fragments-title-wrap small")?.getAttribute("title"),
      ).toBe("Fragments/Alpha renamed.md");
      expect(
        view.contentEl.querySelector<HTMLTextAreaElement>('[aria-label="Fragment text"]')?.value,
      ).toBe("Still editing the out-of-scope file.");
      expect(collection.getAttribute("aria-current")).toBe("true");
      expect(view.contentEl.querySelector(".fragments-result.is-selected")).toBeNull();
    } finally {
      await act(async () => view.onClose());
      view.contentEl.remove();
    }
  });

  it("keeps the unsaved draft by following an external rename", async () => {
    const { app, files, file, view } = await mount();
    try {
      const editor = view.contentEl.querySelector<HTMLTextAreaElement>("textarea");
      expect(editor).not.toBeNull();
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      await act(async () => {
        setter?.call(editor, "Body, still typing.");
        editor?.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Another leaf renames the note before the 700 ms autosave fires.
      await act(async () => {
        await app.fileManager.renameFile(file, "Fragments/Alpha renamed.md");
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(files.get("Fragments/Alpha renamed.md")?.text ?? "").toContain("Body, still typing.");
      expect(
        view.contentEl.querySelector<HTMLInputElement>('[aria-label="Fragment title"]')?.value,
      ).toBe("Alpha");
      expect(
        view.contentEl.querySelector(".fragments-title-wrap small")?.getAttribute("title"),
      ).toBe("Fragments/Alpha renamed.md");
    } finally {
      await act(async () => view.onClose());
      view.contentEl.remove();
    }
  });

  it("keeps the unsaved draft through an external collection folder rename", async () => {
    const { app, files, file, view, handlers } = await mount("Fragments/Examples/Alpha.md");
    const editor = () =>
      view.contentEl.querySelector<HTMLTextAreaElement>('[aria-label="Fragment text"]');
    try {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
          editor(),
          "Body, still typing.",
        );
        editor()?.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Obsidian announces the folder first and re-keys each descendant in its
      // own later event, so the moved note is not yet at its new path when the
      // folder event arrives. All of this happens before the 700 ms autosave.
      await act(async () => {
        const folder = await app.vault.createFolder("Fragments/Examples Renamed");
        handlers.rename?.(folder, "Fragments/Examples");
        await new Promise((resolve) => setTimeout(resolve, 20));
        await app.fileManager.renameFile(file, "Fragments/Examples Renamed/Alpha.md");
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(files.get("Fragments/Examples Renamed/Alpha.md")?.text ?? "").toContain(
        "Body, still typing.",
      );
      expect(editor()?.value).toBe("Body, still typing.");
      expect(view.contentEl.querySelector(".fragments-recovered")).toBeNull();
      expect(view.contentEl.querySelector('[role="alert"]')).toBeNull();
    } finally {
      await act(async () => view.onClose());
      view.contentEl.remove();
    }
  });

  it.each([false, true])(
    "keeps the pending local title through the rename event (dirty body: %s)",
    async (dirty) => {
      const { app, files, view } = await mount();
      let resume!: () => void;
      let signalStarted!: () => void;
      const gate = new Promise<void>((resolve) => (resume = resolve));
      const started = new Promise<void>((resolve) => (signalStarted = resolve));
      const originalWrite = app.fileManager.processFrontMatter.bind(app.fileManager);
      app.fileManager.processFrontMatter = async (...args) => {
        signalStarted();
        await gate;
        return originalWrite(...args);
      };
      const title = () =>
        view.contentEl.querySelector<HTMLInputElement>('[aria-label="Fragment title"]')!;
      try {
        if (dirty) {
          await act(async () => {
            const editor = view.contentEl.querySelector<HTMLTextAreaElement>("textarea")!;
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
              editor,
              "Latest body.",
            );
            editor.dispatchEvent(new Event("input", { bubbles: true }));
          });
        }
        await act(async () => {
          title().focus();
          title().value = "Renamed";
          title().blur();
          await started;
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
        expect(files.has("Fragments/Renamed.md")).toBe(true);
        expect(title().value).toBe("Renamed");
        expect(view.contentEl.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
          dirty ? "Latest body." : "Body.\n",
        );
        await act(async () => {
          resume();
          await new Promise((resolve) => setTimeout(resolve, 30));
        });
        expect(title().value).toBe("Renamed");
        expect(files.get("Fragments/Renamed.md")?.text).toContain('title: "Renamed"');
        expect(files.get("Fragments/Renamed.md")?.text).toContain(dirty ? "Latest body." : "Body.");
        expect(
          view.contentEl.querySelector(".fragments-result.is-selected .fragments-result-name")
            ?.textContent,
        ).toBe("Renamed");
      } finally {
        resume();
        await act(async () => view.onClose());
        view.contentEl.remove();
      }
    },
  );
});
