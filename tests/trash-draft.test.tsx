import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app";
import { FragmentLibrary } from "../src/library";
import type FragmentsPlugin from "../src/main";
import type { FragmentsView } from "../src/view";
import { notices } from "./obsidian-stub";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe("trashing a fragment with unsaved edits", () => {
  it("writes the draft to the trashed file and does not raise a spurious error", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    notices.length = 0;

    const { app, trashed, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", "Alpha body\n", 1_000);

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

    const editor = host.querySelector<HTMLTextAreaElement>(".fragments-editor");
    expect(editor).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setValue?.call(editor, "UNSAVED EDITS");
      editor?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const confirm = window.confirm;
    window.confirm = () => true;
    try {
      const trash = host.querySelector<HTMLButtonElement>('button[title="Move to trash"]');
      expect(trash).not.toBeNull();
      await act(async () => {
        trash?.click();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    } finally {
      window.confirm = confirm;
    }

    expect(trashed.get("Fragments/Alpha.md")?.text).toContain("UNSAVED EDITS");
    expect(notices).not.toContain("Fragment is no longer available.");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
