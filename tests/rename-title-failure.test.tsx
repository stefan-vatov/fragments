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

const note = (title: string, body: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;

describe("rename whose title write fails", () => {
  it("keeps the editor on the fragment at its new path", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    // Beta is first in the recent list, so a cleared selection would jump to it.
    addFile("Fragments/Beta.md", note("Beta", "beta body"), 3_000);
    addFile("Fragments/Alpha.md", note("Alpha", "alpha body"), 1_000);

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
    });

    const result = (name: string): HTMLButtonElement | undefined =>
      [...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-result")].find(
        (button) => button.querySelector(".fragments-result-name")?.textContent === name,
      );

    // Mount selects the most recent note; move the selection to Alpha.
    await act(async () => {
      result("Alpha")?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const input = viewEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]');
    expect(input?.value).toBe("Alpha");

    const fileManager = app.fileManager as unknown as {
      processFrontMatter: () => Promise<void>;
    };
    fileManager.processFrontMatter = async () => {
      throw new Error("disk full");
    };

    await act(async () => {
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).value = "Gamma";
      (input as HTMLInputElement).blur();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The file moved before the title write failed.
    expect([...files.keys()]).toContain("Fragments/Gamma.md");
    // The editor must follow the file instead of jumping to the next fragment.
    const editor = viewEl.querySelector<HTMLTextAreaElement>("textarea");
    expect(editor?.value ?? "").toContain("alpha body");
    await act(async () => root.unmount());
  });
});
