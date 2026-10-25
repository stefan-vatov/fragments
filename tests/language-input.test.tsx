import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app";
import { findLanguage } from "../src/languages";
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

const note = (language: string): string =>
  `---\ntitle: "Note"\ntags: []\nstarred: false\nlanguage: ${JSON.stringify(language)}\n---\n\nBody.\n`;

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const setInput = async (input: HTMLInputElement, value: string): Promise<void> => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const blur = async (input: HTMLInputElement): Promise<void> => {
  await act(async () => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
};

describe("language input", () => {
  it("treats empty input as no choice", () => {
    expect(findLanguage("")).toBeUndefined();
    expect(findLanguage("   ")).toBeUndefined();
    expect(findLanguage("python")?.id).toBe("python");
  });

  it("reverts empty input without rewriting the language", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Note.md", note("python"), 1_000);

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
    await settle();

    const input = host.querySelector<HTMLInputElement>('input[aria-label="Language"]');
    expect(input?.value).toBe("Python");

    await setInput(input!, "");
    await blur(input!);
    await settle();

    expect(input?.value).toBe("Python");
    expect(files.get("Fragments/Note.md")?.text).toContain('language: "python"');

    // A real language still updates the frontmatter.
    await setInput(input!, "Markdown");
    await blur(input!);
    await settle();

    expect(files.get("Fragments/Note.md")?.text).toContain('language: "markdown"');
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Language"]')?.value).toBe(
      "Markdown",
    );

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
