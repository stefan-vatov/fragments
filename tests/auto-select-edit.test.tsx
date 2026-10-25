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

const titleOf = (host: HTMLElement): string =>
  host.querySelector<HTMLInputElement>(".fragments-title-wrap input")?.value ?? "";

const findButton = (host: HTMLElement, label: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(label),
  );
  if (!found) throw new Error(`no button matching ${label}`);
  return found;
};

const typeInto = async (host: HTMLElement, text: string): Promise<void> => {
  const editor = editorOf(host);
  expect(editor).not.toBeNull();
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setValue?.call(editor, text);
    editor?.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const frontmatter = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: true\nlanguage: plaintext\n---\n\n`;

describe("acting on the open fragment while editing", () => {
  it("keeps the editor on the fragment when un-starring removes it from the active scope", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", `${frontmatter("Alpha")}Alpha body text.\n`, 3_000);
    addFile("Fragments/Beta.md", `${frontmatter("Beta")}Beta body text.\n`, 2_000);

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

    await act(async () => {
      findButton(host, "Starred").click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(titleOf(host)).toBe("Alpha");

    await typeInto(host, "Alpha body text.\n PLUS-MY-DRAFT");
    expect(host.querySelector(".fragments-editor-footer")?.textContent).toContain(
      "Unsaved changes",
    );

    // Un-star the fragment the user is editing; it drops out of the Starred
    // scope, but the editor must stay on it.
    const unstar = host.querySelector<HTMLButtonElement>('button[aria-label="Unstar fragment"]');
    expect(unstar).not.toBeNull();
    await act(async () => {
      unstar?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(titleOf(host)).toBe("Alpha");
    expect(editorOf(host)?.value).toContain("PLUS-MY-DRAFT");

    // Everything typed after the un-star still belongs to Alpha.
    await typeInto(host, "Alpha body text.\n PLUS-MY-DRAFT SECOND-HALF-INTENDED-FOR-ALPHA");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });

    expect(files.get("Fragments/Alpha.md")?.text).toContain("SECOND-HALF-INTENDED-FOR-ALPHA");
    expect(files.get("Fragments/Beta.md")?.text).not.toContain("SECOND-HALF-INTENDED-FOR-ALPHA");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
