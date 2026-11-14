import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (body: string): string =>
  `---\ntitle: Alpha\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;

describe("body read sequencing", () => {
  it("does not apply a read that started before the file was replaced at the same path", async () => {
    const { app, vault, addFile, files } = createTestVault();
    addFile("Fragments/Alpha.md", note("old body"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });

    let releaseOld: (() => void) | undefined;
    let calls = 0;
    const original = vault.cachedRead;
    vault.cachedRead = async (file) => {
      calls++;
      if (calls === 1) {
        await new Promise<void>((resolve) => {
          releaseOld = resolve;
        });
        return note("old body");
      }
      return files.get(file.path)?.text ?? "";
    };

    const loaded = library.load();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The user deletes the note and a new one is created at the same path
    // (Obsidian sync, another plugin, or delete-then-new-fragment).
    library.remove("Fragments/Alpha.md");
    const next = addFile("Fragments/Alpha.md", note("new body"), 2_000);
    await library.refresh(next);

    // The read that started before the delete now resolves.
    releaseOld?.();
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 0));
    vault.cachedRead = original;

    const entry = library.entries()[0];
    expect(entry?.preview).toBe("new body");
    expect(entry?.searchText).not.toContain("old body");
  });
});
