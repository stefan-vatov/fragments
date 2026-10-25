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

const editorOf = (host: HTMLElement): HTMLTextAreaElement | null =>
  host.querySelector<HTMLTextAreaElement>(".fragments-editor");

const footerOf = (host: HTMLElement): string =>
  host.querySelector(".fragments-editor-footer")?.textContent ?? "";

const typeInto = async (host: HTMLElement, text: string): Promise<void> => {
  const editor = editorOf(host);
  expect(editor).not.toBeNull();
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setValue?.call(editor, text);
    editor?.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("draft load racing with typing", () => {
  it("keeps an edit typed while a re-read for the same fragment is in flight", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    const file = addFile("Fragments/alpha.md", "Body of Alpha\n", 2_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const plugin = {
      app,
      library,
      settings: { folder: "Fragments", snippetFont: "monospace", customSnippetFont: "" },
      subscribeSettings: () => () => undefined,
      settingsSnapshot: () => 0,
    } as unknown as FragmentsPlugin;
    const view = {
      containerEl: document.body,
      contentEl: document.createElement("div"),
    } as unknown as FragmentsView;

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
    });
    expect(editorOf(host)?.value).toBe("Body of Alpha\n");

    // Hold the next body read so the user can type while it is in flight.
    let release: (() => void) | undefined;
    const readBody = library.read.bind(library);
    library.read = (path: string) =>
      new Promise((resolve) => {
        release = () => {
          void readBody(path).then(resolve);
        };
      });

    // An external touch bumps the fragment's mtime and makes the load effect
    // issue a fresh read for the still-clean fragment.
    (file as unknown as { stat: { mtime: number } }).stat.mtime += 60_000;
    await act(async () => {
      await library.refresh(file);
    });
    expect(release).toBeDefined();

    await typeInto(host, "USER TYPED THIS");
    expect(footerOf(host)).toContain("Unsaved changes");

    // The stale read now resolves with the on-disk body.
    await act(async () => {
      release?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(editorOf(host)?.value).toBe("USER TYPED THIS");
    expect(footerOf(host)).toContain("Unsaved changes");

    // The draft still autosaves to disk.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(files.get("Fragments/alpha.md")?.text).toContain("USER TYPED THIS");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
