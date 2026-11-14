import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("the scratchpad reservation", () => {
  it("does not index a case variant of the pad as a fragment", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note, 1_000);
    addFile("Fragments/_FRAGMENTS-SCRATCHPAD.md", note, 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    expect(library.entries().map((entry) => entry.path)).toEqual(["Fragments/Alpha.md"]);
  });

  it("refuses a rename onto a case variant of the pad", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note, 1_000);
    addFile("Fragments/_fragments-scratchpad.md", note, 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    await expect(library.rename("Fragments/Alpha.md", "_FRAGMENTS-SCRATCHPAD")).rejects.toThrow(
      /reserved for the scratchpad/,
    );
  });
});
