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

const openCollectionDialog = async (host: HTMLElement): Promise<void> => {
  const open = [...host.querySelectorAll("button")].find(
    (button) => button.getAttribute("title") === "New collection",
  );
  expect(open).not.toBeUndefined();
  await act(async () => {
    open?.click();
  });
};

describe("new-collection dialog", () => {
  it("opens empty after the previous attempt was abandoned", async () => {
    const { root, viewEl } = await mount();

    await openCollectionDialog(viewEl);
    const input = viewEl.querySelector<HTMLInputElement>('input[aria-label="Collection name"]');
    expect(input).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(input, "Abandoned");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      viewEl.querySelector<HTMLButtonElement>('button[aria-label="Close new collection"]')?.click();
    });

    await openCollectionDialog(viewEl);
    const reopened = viewEl.querySelector<HTMLInputElement>('input[aria-label="Collection name"]');
    expect(reopened?.value).toBe("");
    await act(async () => root.unmount());
  });
});
