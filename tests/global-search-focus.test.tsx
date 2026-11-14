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

const note = (title: string): string =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const mount = async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const vault = createTestVault();
  vault.addFile("Fragments/Alpha.md", note("Alpha"), 1_000);
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

describe("global search focus", () => {
  it("closes the results when focus leaves the field", async () => {
    const { root, viewEl } = await mount();
    const input = viewEl.querySelector<HTMLInputElement>(
      'input[aria-label="Search all fragments by title or tag"]',
    );
    expect(input).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

    await act(async () => {
      input?.focus();
      setValue?.call(input, "alp");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(viewEl.querySelector(".fragments-global-results")).not.toBeNull();

    await act(async () => {
      input?.blur();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Tabbing away must not leave an orphaned listbox behind.
    expect(viewEl.querySelector(".fragments-global-results")).toBeNull();
    await act(async () => root.unmount());
  });
});
