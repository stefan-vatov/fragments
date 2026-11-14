import { describe, expect, it, vi } from "vitest";
import { FragmentsSettingTab } from "../src/settings";
import type FragmentsPlugin from "../src/main";

interface FakeText {
  getValue: () => string;
  setValue: (value: string) => void;
  inputEl: HTMLInputElement;
}

describe("changing the library folder", () => {
  it("ignores a second selection while the first is still reloading", async () => {
    const gates: Array<() => void> = [];
    // The real library adopts the requested folder before loading.
    const settings = { folder: "Fragments" };
    const changeFolder = vi.fn((folder: string) => {
      settings.folder = folder;
      return new Promise<void>((resolve) => {
        gates.push(resolve);
      });
    });
    const saveSettings = vi.fn(async () => undefined);
    const plugin = {
      settings,
      flushDrafts: async () => undefined,
      saveSettings,
      library: { changeFolder },
    } as unknown as FragmentsPlugin;

    const tab = new FragmentsSettingTab({} as never, plugin);
    const run = (
      tab as unknown as { updateFolder: (text: FakeText) => Promise<void> }
    ).updateFolder.bind(tab);

    const inputEl = document.createElement("input");
    let value = "Other";
    const text: FakeText = {
      getValue: () => value,
      setValue: (next: string) => {
        value = next;
      },
      inputEl,
    };

    const first = run(text);
    const second = run(text);
    // Let both calls reach the gated folder change before releasing anything.
    for (let index = 0; index < 100 && gates.length === 0; index += 1)
      await new Promise((resolve) => setTimeout(resolve, 5));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(gates.length).toBe(1);
    for (const gate of gates.splice(0)) gate();
    await Promise.all([first, second]);

    expect(changeFolder).toHaveBeenCalledTimes(1);
    expect(changeFolder).toHaveBeenCalledWith("Other");
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(inputEl.disabled).toBe(false);
    expect(value).toBe("Other");
  });
});
