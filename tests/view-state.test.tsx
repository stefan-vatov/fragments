import { act } from "react";
import { describe, expect, it } from "vitest";
import FragmentsPlugin from "../src/main";
import { FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const note = `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nAlpha body\n`;

const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const typeInto = async (input: HTMLInputElement | null, value: string): Promise<void> => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
  });
};

describe("view state", () => {
  it("restores the selection, query and mode with the leaf", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();
    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note, Date.now() - 86_400_000);
    let leaf: { view?: unknown } = {};
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [leaf],
        detachLeavesOfType: () => undefined,
      },
    });
    (app.vault as unknown as Record<string, unknown>).on = () => ({});
    (app.metadataCache as unknown as Record<string, unknown>).on = () => ({});

    const plugin = new FragmentsPlugin(app as never, {} as never);
    Object.assign(plugin, {
      loadData: async () => null,
      registerView: () => undefined,
      addSettingTab: () => undefined,
      addRibbonIcon: () => undefined,
      addCommand: () => undefined,
      registerObsidianProtocolHandler: () => undefined,
      registerEvent: () => undefined,
    });
    await plugin.onload();

    const view = new FragmentsView(leaf as never, plugin);
    leaf = { view };
    document.body.append(view.contentEl);
    await act(async () => {
      await view.onOpen();
      await tick();
    });

    await act(async () => {
      view.contentEl.querySelector<HTMLButtonElement>(".fragments-result")?.click();
      await tick();
    });
    await typeInto(
      view.contentEl.querySelector<HTMLInputElement>('input[aria-label="Search fragments"]'),
      "al",
    );
    await act(async () => {
      view.contentEl
        .querySelector<HTMLButtonElement>('button[aria-label="Preview fragment"]')
        ?.click();
      await tick();
    });

    const state = view.getState();
    expect(state.fragments).toMatchObject({
      selected: "Fragments/Alpha.md",
      query: "al",
      mode: "preview",
    });

    await act(async () => {
      await view.onClose();
    });
    const second = new FragmentsView({} as never, plugin);
    await second.setState(state);
    await act(async () => {
      await second.onOpen();
      await tick();
    });

    expect(
      second.contentEl.querySelector<HTMLInputElement>('input[aria-label="Fragment title"]')?.value,
    ).toBe("Alpha");
    expect(
      second.contentEl.querySelector<HTMLInputElement>('input[aria-label="Search fragments"]')
        ?.value,
    ).toBe("al");
    expect(
      second.contentEl
        .querySelector<HTMLButtonElement>('button[aria-label="Preview fragment"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    await act(async () => {
      await second.onClose();
    });
  });
});
