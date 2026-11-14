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

describe("deleting the scratchpad outside Fragments", () => {
  it("marks the open pad unsaved and lets the next write recreate it", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    const padPath = "Fragments/_fragments-scratchpad.md";
    const padFile = addFile(padPath, "hello", 1_000);

    const handlers: Record<string, (file: unknown, oldPath?: string) => void> = {};
    let leaf: { view?: unknown } = {};
    Object.assign(app as unknown as Record<string, unknown>, {
      workspace: {
        onLayoutReady: (callback: () => void) => callback(),
        getLeavesOfType: () => [leaf],
        detachLeavesOfType: () => undefined,
      },
    });
    (app.vault as unknown as Record<string, unknown>).on = (
      event: string,
      callback: (file: unknown, oldPath?: string) => void,
    ) => {
      handlers[event] = callback;
      return {};
    };
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
    // The stub's contentEl starts detached; focus/blur need a live document.
    document.body.append(view.contentEl);
    await act(async () => {
      await view.onOpen();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    const status = (): Element | null =>
      view.contentEl.querySelector(".fragments-scratchpad-header [data-status]");
    expect(status()?.getAttribute("data-status")).toBe("saved");

    // Another leaf deletes the pad file.
    await act(async () => {
      files.delete(padPath);
      handlers.delete?.(padFile);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const pad = view.contentEl.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Scratchpad text"]',
    );
    expect(pad?.value).toBe("hello");
    expect(status()?.getAttribute("data-status")).toBe("empty");

    // The next write recreates the file.
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      pad?.focus();
      setter?.call(pad, "hello again");
      pad?.dispatchEvent(new Event("input", { bubbles: true }));
      pad?.blur();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(status()?.getAttribute("data-status")).toBe("saved");
    expect(files.get(padPath)?.text).toBe("hello again");
  });
});
