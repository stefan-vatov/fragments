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

const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const mount = async (withNote: boolean) => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  document.body.replaceChildren();
  const { app, addFile } = createTestVault();
  if (withNote) addFile("Fragments/Note.md", note, 1_000);
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

describe("the empty list state", () => {
  it("distinguishes no matches from an empty library", async () => {
    const { root, viewEl } = await mount(true);
    const search = viewEl.querySelector<HTMLInputElement>('input[aria-label="Search fragments"]');
    await act(async () => {
      type(search as HTMLInputElement, "zzz");
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const empty = viewEl.querySelector(".fragments-empty");
    expect(empty?.textContent ?? "").toContain("No matches");

    const clear = [...(empty?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
      (button) => button.textContent === "Clear filters",
    );
    expect(clear).not.toBeUndefined();
    await act(async () => {
      clear?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect((search as HTMLInputElement).value).toBe("");
    expect(viewEl.querySelectorAll(".fragments-result").length).toBe(1);
    await act(async () => root.unmount());
  });

  it("keeps the create state for a genuinely empty library", async () => {
    const { root, viewEl } = await mount(false);
    const empty = viewEl.querySelector(".fragments-empty");
    expect(empty?.textContent ?? "").toContain("No fragments yet");
    expect(empty?.textContent ?? "").not.toContain("No matches");
    await act(async () => root.unmount());
  });
});
