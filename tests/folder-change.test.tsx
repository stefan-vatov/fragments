import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppShell, type ShellHandle } from "../src/app";
import { FragmentLibrary } from "../src/library";
import FragmentsPlugin from "../src/main";
import { FragmentsSettingTab } from "../src/settings";
import { FRAGMENTS_VIEW, FragmentsView } from "../src/view";
import { createTestVault } from "./vault";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

interface FakeText {
  inputEl: HTMLInputElement;
  getValue: () => string;
  setValue: (value: string) => void;
}

const textComponent = (value: string): FakeText => {
  let current = value;
  return {
    inputEl: document.createElement("input"),
    getValue: () => current,
    setValue: (next) => {
      current = next;
    },
  };
};

const typeInto = async (host: HTMLElement, text: string): Promise<void> => {
  const editor = host.querySelector<HTMLTextAreaElement>(".fragments-editor");
  expect(editor).not.toBeNull();
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setValue?.call(editor, text);
    editor?.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("changing the fragments folder with an open draft", () => {
  it("flushes the draft to the old folder before switching", async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    document.body.replaceChildren();

    const { app, files, addFile } = createTestVault();
    addFile("Fragments/alpha.md", "Body of Alpha\n", 2_000);
    addFile("Notes/other.md", "Body of Other\n", 1_000);

    const plugin = new FragmentsPlugin(app, {} as never);
    plugin.settings = { folder: "Fragments", snippetFont: "monospace", customSnippetFont: "" };
    // Production shares one settings object between the plugin and the library,
    // so a folder change is visible on both.
    const library = new FragmentLibrary(app, plugin.settings);
    plugin.library = library;
    await library.load();

    const view = new FragmentsView({} as never, plugin);
    (app as unknown as { workspace: object }).workspace = {
      getLeavesOfType: (type: string) => (type === FRAGMENTS_VIEW ? [{ view }] : []),
    };

    const root = createRoot(view.contentEl);
    await act(async () => {
      root.render(
        <AppShell
          plugin={plugin}
          view={view}
          handle={(handle: ShellHandle | null) => {
            (view as unknown as { shell: ShellHandle | null }).shell = handle;
          }}
        />,
      );
    });

    await typeInto(view.contentEl, "MY UNSAVED WORK");
    expect(files.get("Fragments/alpha.md")?.text).not.toContain("MY UNSAVED WORK");

    const text = textComponent("Notes");
    const tab = new FragmentsSettingTab(app, plugin);
    await act(async () => {
      await (tab as unknown as { updateFolder: (text: FakeText) => Promise<void> }).updateFolder(
        text,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(files.get("Fragments/alpha.md")?.text).toContain("MY UNSAVED WORK");
    expect(library.folder()).toBe("Notes");
    expect(text.getValue()).toBe("Notes");
    expect(view.contentEl.querySelector<HTMLTextAreaElement>(".fragments-editor")?.value).toBe(
      "Body of Other\n",
    );

    await act(async () => {
      root.unmount();
    });
    view.contentEl.remove();
  });
});
