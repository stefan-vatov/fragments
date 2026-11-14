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

describe("scratchpad conflict", () => {
  it("does not overwrite the external version on the next flush", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, files, addFile } = createTestVault();
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
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const pad = viewEl.querySelector<HTMLTextAreaElement>('textarea[aria-label="Scratchpad text"]');
    expect(pad).not.toBeNull();
    const scratchPath = library.scratchpadPath();

    // First edit lands normally.
    await act(async () => {
      (pad as HTMLTextAreaElement).focus();
      type(pad as HTMLTextAreaElement, "mine");
      (pad as HTMLTextAreaElement).blur();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(files.get(scratchPath)?.text).toBe("mine");

    // Another leaf saves over the pad.
    const entry = files.get(scratchPath);
    expect(entry).not.toBeUndefined();
    if (entry) entry.text = "keep this";

    // The conflict is reported and the buffer stays put.
    await act(async () => {
      (pad as HTMLTextAreaElement).focus();
      type(pad as HTMLTextAreaElement, "mine2");
      (pad as HTMLTextAreaElement).blur();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(files.get(scratchPath)?.text).toBe("keep this");

    // Typing again must not adopt the external text and write over it.
    await act(async () => {
      (pad as HTMLTextAreaElement).focus();
      type(pad as HTMLTextAreaElement, "mine3");
      (pad as HTMLTextAreaElement).blur();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(files.get(scratchPath)?.text).toBe("keep this");
    await act(async () => root.unmount());
  });
});
