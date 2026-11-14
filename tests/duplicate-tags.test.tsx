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

const note = (tags: string): string =>
  `---\ntitle: Note\ntags: ${tags}\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const mount = async (seed: (vault: ReturnType<typeof createTestVault>) => void) => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const vault = createTestVault();
  seed(vault);
  const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
  await library.load();
  const plugin = {
    app: vault.app,
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
  return { root, viewEl, library, vault };
};

const typeInto = async (input: HTMLInputElement, value: string): Promise<void> => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    input.focus();
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("duplicate tags", () => {
  it("cannot be introduced through the tag editor, and are not counted twice", async () => {
    const { root, viewEl, library, vault } = await mount((vault) => {
      vault.addFile("Fragments/Note.md", note("[]"), 1_000);
    });

    const addTag = viewEl.querySelector<HTMLButtonElement>(".fragments-tags button");
    expect(addTag).not.toBeNull();
    await act(async () => {
      addTag?.click();
    });
    const input = viewEl.querySelector<HTMLInputElement>(".fragments-tag-input");
    expect(input).not.toBeNull();
    await typeInto(input as HTMLInputElement, "Work, work");
    await act(async () => {
      (input as HTMLInputElement).blur();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(library.entries()[0]?.tags).toEqual(["work"]);
    expect(vault.files.get("Fragments/Note.md")?.text).toContain("tags: [work]");
    expect(viewEl.querySelectorAll(".fragments-tags span")).toHaveLength(1);

    const tagButton = [
      ...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-sidebar button"),
    ].find((button) => button.textContent?.includes("#work"));
    expect(tagButton?.textContent).toContain("1");

    await act(async () => root.unmount());
  });

  it("collapses duplicates that already exist in a note's frontmatter", async () => {
    const { root, viewEl, library } = await mount((vault) => {
      vault.addFile("Fragments/Note.md", note("[work, Work]"), 1_000);
    });

    // The render must survive a note that was authored with duplicates.
    expect(library.entries()[0]?.tags).toEqual(["work"]);
    expect(viewEl.querySelectorAll(".fragments-tags span")).toHaveLength(1);
    await act(async () => root.unmount());
  });
});
