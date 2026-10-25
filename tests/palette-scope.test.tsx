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

const renderShell = async (): Promise<{
  host: HTMLElement;
  root: ReturnType<typeof createRoot>;
}> => {
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
  return { host, root };
};

describe("command palette and the active collection scope", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
  });

  it("opens the fragment picked from the palette even when it is outside the active collection", async () => {
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
    expect(host.querySelector(".fragments-list-summary")?.textContent).toContain("3 snippets");
    expect(host.querySelector<HTMLInputElement>(".fragments-title-wrap input")?.value).toBe(
      "Gamma",
    );
    expect(host.querySelector(".fragments-result.is-selected")?.textContent).toContain("Gamma");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
