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

const note = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const setInput = async (input: HTMLInputElement, value: string): Promise<void> => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const pressEnter = async (input: HTMLInputElement): Promise<void> => {
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe("new collection dialog", () => {
  it("creates the collection when Enter is pressed", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note("Alpha"), 1_000);
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

    const open = host.querySelector<HTMLButtonElement>('button[title="New collection"]');
    expect(open).not.toBeNull();
    await act(async () => open!.click());

    const input = host.querySelector<HTMLInputElement>('input[placeholder="Collection name"]');
    expect(input).not.toBeNull();
    await setInput(input!, "reading");
    await pressEnter(input!);

    expect(host.querySelector(".fragments-small-dialog")).toBeNull();
    expect(library.collections()).toEqual(["reading"]);
  });
});
