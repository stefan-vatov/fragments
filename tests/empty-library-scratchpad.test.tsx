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

const type = (input: HTMLTextAreaElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("an empty library", () => {
  it("keeps the scratchpad available", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, files } = createTestVault();
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
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(viewEl.querySelector(".fragments-welcome")).not.toBeNull();
    const pad = viewEl.querySelector<HTMLTextAreaElement>('textarea[aria-label="Scratchpad text"]');
    expect(pad).not.toBeNull();

    await act(async () => {
      (pad as HTMLTextAreaElement).focus();
      type(pad as HTMLTextAreaElement, "shared notes");
      (pad as HTMLTextAreaElement).blur();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(files.get(library.scratchpadPath())?.text).toBe("shared notes");
    await act(async () => root.unmount());
  });
});
