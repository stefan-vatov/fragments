import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
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

const element = (): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>(".fragments-palette input");

const findButton = (host: HTMLElement, label: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(label),
  );
  if (!found) throw new Error(`no button matching ${label}`);
  return found;
};

const renderShell = async () => {
  const vault = createTestVault();
  vault.addFile("Fragments/Work/Alpha.md", "Alpha body", 3_000);
  vault.addFile("Fragments/Work/Beta.md", "Beta body", 2_000);
  vault.addFile("Fragments/Home/Gamma.md", "Gamma body", 1_000);

  const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
  await library.load();

  const plugin = {
    app: vault.app,
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
  return { host, root, files: vault.files };
};

describe("command palette and the active collection scope", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
  });

  it.each(["Alpha", ""])(
    "reaches New snippet with ArrowDown when the query is %j",
    async (query) => {
      const { host, root, files } = await renderShell();
      try {
        await act(async () =>
          host.querySelector<HTMLButtonElement>('[aria-label="Search commands"]')!.click(),
        );
        const input = element()!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            input,
            query,
          );
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        const results = host.querySelectorAll(".fragments-palette button").length - 1;
        for (let index = 0; index < results; index++) {
          await act(async () =>
            input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })),
          );
        }
        expect(host.querySelector(".fragments-palette button.active")?.textContent).toBe(
          "New snippet",
        );
        await act(async () =>
          input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
        );
        expect(host.querySelector(".fragments-palette")).toBeNull();
        expect(files.has("Fragments/Untitled fragment.md")).toBe(true);
        expect(host.querySelector<HTMLInputElement>('[aria-label="Fragment title"]')?.value).toBe(
          "Untitled fragment",
        );
      } finally {
        await act(async () => root.unmount());
        host.remove();
      }
    },
  );

  it("opens a palette pick outside the active collection without losing the scope", async () => {
    const { host, root } = await renderShell();

    await act(async () => {
      findButton(host, "Work").click();
    });
    expect(host.querySelector(".fragments-list-summary")?.textContent).toContain("2 snippets");
    expect(host.querySelector<HTMLInputElement>(".fragments-title-wrap input")?.value).toBe(
      "Alpha",
    );

    await act(async () => {
      host.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    const input = element();
    expect(input).not.toBeNull();

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "gamma");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(host.querySelector(".fragments-palette")).toBeNull();
    // The pick opens, but the active collection scope is not discarded; the
    // picked fragment is simply outside the filtered list.
    expect(host.querySelector(".fragments-list-summary")?.textContent).toContain("2 snippets");
    expect(host.querySelector<HTMLInputElement>(".fragments-title-wrap input")?.value).toBe(
      "Gamma",
    );
    expect(host.querySelector(".fragments-result.is-selected")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
