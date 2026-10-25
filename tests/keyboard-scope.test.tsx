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

const key = (target: HTMLElement, init: KeyboardEventInit): boolean =>
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

const mount = async (): Promise<{
  root: ReturnType<typeof createRoot>;
  viewEl: HTMLElement;
  outside: HTMLElement;
  files: Map<string, { file: unknown; text: string }>;
}> => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();

  const { app, files, addFile } = createTestVault();
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

  const viewEl = document.createElement("div");
  viewEl.tabIndex = 0;
  document.body.append(viewEl);
  const outside = document.createElement("div");
  outside.tabIndex = 0;
  document.body.append(outside);

  const view = { containerEl: viewEl, contentEl: viewEl } as unknown as FragmentsView;
  const root = createRoot(viewEl);
  await act(async () => {
    root.render(<AppShell plugin={plugin} view={view} handle={() => undefined} />);
  });
  return { root, viewEl, outside, files };
};

describe("fragments keyboard shortcuts", () => {
  it("ignores ctrl+k and escape from outside the view", async () => {
    const { root, viewEl, outside } = await mount();

    await act(async () => {
      expect(key(outside, { key: "k", ctrlKey: true })).toBe(true);
    });
    expect(document.querySelector(".fragments-palette")).toBeNull();

    await act(async () => {
      expect(key(viewEl, { key: "k", ctrlKey: true })).toBe(false);
    });
    expect(document.querySelector(".fragments-palette")).not.toBeNull();

    // Escape from an unrelated pane must not dismiss the Fragments dialog.
    await act(async () => {
      key(outside, { key: "Escape" });
    });
    expect(document.querySelector(".fragments-palette")).not.toBeNull();

    await act(async () => {
      key(viewEl, { key: "Escape" });
    });
    expect(document.querySelector(".fragments-palette")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("does not save the open draft for ctrl+s from outside the view", async () => {
    const { root, viewEl, outside, files } = await mount();

    const editor = viewEl.querySelector<HTMLTextAreaElement>(".fragments-editor");
    expect(editor).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setValue?.call(editor, "MY DRAFT");
      editor?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(viewEl.querySelector(".fragments-editor-footer")?.textContent).toContain(
      "Unsaved changes",
    );

    await act(async () => {
      expect(key(outside, { key: "s", ctrlKey: true })).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(files.get("Fragments/Alpha.md")?.text).not.toContain("MY DRAFT");

    await act(async () => {
      expect(key(viewEl, { key: "s", ctrlKey: true })).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(files.get("Fragments/Alpha.md")?.text).toContain("MY DRAFT");

    await act(async () => {
      root.unmount();
    });
  });
});
