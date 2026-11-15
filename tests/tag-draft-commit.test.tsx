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

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body\n`;
const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("tag edits across a selection change", () => {
  it("commits the typed tags to the fragment they were typed for", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const vault = createTestVault();
    const file = vault.addFile("Fragments/Alpha.md", note("Alpha"), 1_000);
    vault.addFile("Fragments/Beta.md", note("Beta"), 2_000);
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
      await tick();
    });

    await act(async () => {
      [...viewEl.querySelectorAll<HTMLButtonElement>(".fragments-result")]
        .find((button) => button.textContent?.includes("Alpha"))
        ?.click();
      await tick();
    });
    const addTag = [...viewEl.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "+ tag",
    );
    await act(async () => {
      addTag?.click();
      await tick();
    });
    const tagInput = viewEl.querySelector<HTMLInputElement>('input[aria-label="Edit tags"]');
    expect(tagInput).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      tagInput?.focus();
      setter?.call(tagInput, "studio");
      tagInput?.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });

    // External rename while the tag editor still holds focus: no blur fires.
    await act(async () => {
      const entry = vault.files.get("Fragments/Alpha.md");
      if (!entry) throw new Error("missing file");
      const text = entry.text;
      vault.files.delete("Fragments/Alpha.md");
      // The plugin's rename handler evicts the old path, records the move and
      // re-indexes the file under its new path.
      library.remove("Fragments/Alpha.md");
      const renamed = vault.addFile("Fragments/Renamed.md", text, entry.file.stat.mtime);
      library.relocate("Fragments/Alpha.md", "Fragments/Renamed.md");
      await library.refresh(renamed);
      await tick(120);
    });

    const written = vault.files.get("Fragments/Renamed.md")?.text ?? "";
    expect(written).toContain("studio");
    expect(viewEl.querySelector('input[aria-label="Edit tags"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
