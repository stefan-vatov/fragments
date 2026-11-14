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

const note = `---\ntitle: Note\ntags: [work]\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const mount = async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const vault = createTestVault();
  vault.addFile("Fragments/Note.md", note, 1_000);
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
  return { root, viewEl };
};

describe("sidebar section headings", () => {
  it("does not show a collapse chevron on the Tags heading", async () => {
    const { root, viewEl } = await mount();
    const headings = [...viewEl.querySelectorAll<HTMLElement>(".fragments-section-heading")];
    const tagsHeading = headings.find((heading) => heading.textContent?.includes("Tags"));

    expect(tagsHeading).not.toBeUndefined();
    // Nothing in the Tags section collapses, so a chevron would promise an
    // interaction that does not exist.
    expect(tagsHeading?.querySelector("svg")).toBeNull();
    expect(tagsHeading?.querySelector("button")).toBeNull();
    await act(async () => root.unmount());
  });
});
