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

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody\n`;
const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const mount = async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const vault = createTestVault();
  const file = vault.addFile("Fragments/Note.md", note, 1_000);
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
  const title = () => viewEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]');
  const renameExternally = async (next: string) => {
    const entry = vault.files.get("Fragments/Note.md");
    if (!entry) throw new Error("missing file");
    entry.text = note.replace("title: Note", `title: ${next}`);
    await library.refresh(file);
  };
  return { root, viewEl, vault, file, library, title, renameExternally };
};

describe("external title changes", () => {
  it("keeps an in-progress title edit instead of remounting the field", async () => {
    const { root, title, renameExternally } = await mount();
    const before = title();
    expect(before).not.toBeNull();

    await act(async () => {
      before?.focus();
      if (before) before.value = "Typed but uncommitted";
      await tick();
    });
    await act(async () => {
      await renameExternally("External");
      await tick();
    });

    expect(title()).toBe(before);
    expect(before?.isConnected).toBe(true);
    expect(before?.value).toBe("Typed but uncommitted");
    await act(async () => root.unmount());
  });

  it("adopts an external title when the field is not focused", async () => {
    const { root, title, renameExternally } = await mount();
    await act(async () => {
      await renameExternally("External");
      await tick();
    });
    expect(title()?.value).toBe("External");
    await act(async () => root.unmount());
  });
});
