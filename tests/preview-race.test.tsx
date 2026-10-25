import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app";
import { FragmentLibrary } from "../src/library";
import type FragmentsPlugin from "../src/main";
import type { FragmentsView } from "../src/view";
import { MarkdownRenderer } from "./obsidian-stub";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

interface PendingRender {
  body: string;
  resolve: () => void;
}

const note = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: markdown\n---\n\n${title}_CONTENT\n`;

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe("preview render races", () => {
  it("keeps the current fragment when an older markdown render resolves later", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const pending: PendingRender[] = [];
    const original = MarkdownRenderer.render;
    MarkdownRenderer.render = ((_app: unknown, body: string, element: HTMLElement) =>
      new Promise<void>((resolve) => {
        pending.push({
          body,
          resolve: () => {
            element.textContent = `RENDERED:${body.trim()}`;
            resolve();
          },
        });
      })) as typeof MarkdownRenderer.render;

    try {
      const { app, addFile } = createTestVault();
      addFile("Fragments/Alpha.md", note("ALPHA"), 3_000);
      addFile("Fragments/Beta.md", note("BETA"), 2_000);

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
      await settle();

      const preview = host.querySelector<HTMLButtonElement>(
        'button[aria-label="Preview fragment"]',
      );
      expect(preview).not.toBeNull();
      await act(async () => {
        preview?.click();
      });
      await settle();

      const alphaRender = pending.find((render) => render.body.includes("ALPHA_CONTENT"));
      expect(alphaRender).toBeDefined();

      const betaRow = [...host.querySelectorAll<HTMLButtonElement>(".fragments-result")].find(
        (row) => row.textContent?.includes("BETA"),
      );
      expect(betaRow).toBeDefined();
      await act(async () => {
        betaRow?.click();
      });
      await settle();

      const betaRender = pending.find((render) => render.body.includes("BETA_CONTENT"));
      expect(betaRender).toBeDefined();

      await act(async () => {
        betaRender?.resolve();
      });
      await settle();
      expect(host.querySelector(".fragments-preview")?.textContent).toBe("RENDERED:BETA_CONTENT");

      // The stale Alpha render resolves last; it must not overwrite Beta.
      await act(async () => {
        alphaRender?.resolve();
      });
      await settle();
      expect(host.querySelector(".fragments-preview")?.textContent).toBe("RENDERED:BETA_CONTENT");

      await act(async () => {
        root.unmount();
      });
      host.remove();
    } finally {
      MarkdownRenderer.render = original;
    }
  });
});
