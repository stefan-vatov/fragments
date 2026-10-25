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

const note = (title: string, tags: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: ${tags}\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body.\n`;

const tagRows = (host: HTMLElement): HTMLButtonElement[] =>
  [...host.querySelectorAll<HTMLButtonElement>(".fragments-sidebar button")].filter((button) =>
    button.querySelector("span")?.textContent?.startsWith("#"),
  );

describe("tag case normalisation", () => {
  it("treats Work and work as one tag in the sidebar and the tag scope", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, addFile } = createTestVault();
    addFile("Fragments/A.md", note("A", "[Work, js]"), 3_000);
    addFile("Fragments/B.md", note("B", "[work]"), 2_000);

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    expect(
      library
        .entries()
        .map((entry) => entry.tags)
        .sort(),
    ).toEqual([["work"], ["work", "js"]]);

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

    const workRows = tagRows(host).filter((row) => row.textContent?.includes("#work"));
    expect(workRows).toHaveLength(1);
    expect(workRows[0]?.textContent).toContain("2");

    await act(async () => {
      workRows[0]?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector(".fragments-list-summary")?.textContent).toContain("2 snippets");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("writes edited tags in canonical lowercase", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    addFile("Fragments/A.md", note("A", "[Work]"), 1_000);

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

    const addTag = [...host.querySelectorAll<HTMLButtonElement>(".fragments-tags button")].find(
      (button) => button.textContent === "+ tag",
    );
    expect(addTag).toBeDefined();
    await act(async () => {
      addTag?.click();
    });

    const input = host.querySelector<HTMLInputElement>('input[aria-label="Edit tags"]');
    expect(input).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "work, js, MixedCase");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(files.get("Fragments/A.md")?.text).toContain("mixedcase");
    expect(files.get("Fragments/A.md")?.text).not.toContain("MixedCase");
    expect(library.entries()[0]?.tags).toEqual(["work", "js", "mixedcase"]);

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
