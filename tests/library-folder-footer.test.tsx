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

const mount = async (withFolder: boolean) => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const { app, addFile } = createTestVault();
  if (withFolder) addFile("Fragments/Note.md", note, 1_000);
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
  return { root, viewEl };
};

describe("the sidebar footer", () => {
  it("shows the library folder", async () => {
    const { root, viewEl } = await mount(true);
    const footer = viewEl.querySelector(".fragments-sidebar-footer");
    expect(footer?.textContent ?? "").toContain("Folder · Fragments");
    expect(footer?.querySelector(".fragments-folder-missing")).toBeNull();
    await act(async () => root.unmount());
  });

  it("flags a configured folder that is missing", async () => {
    const { root, viewEl } = await mount(false);
    const missing = viewEl.querySelector(".fragments-folder-missing");
    expect(missing).not.toBeNull();
    expect(missing?.textContent ?? "").toContain("not found");
    await act(async () => root.unmount());
  });
});
