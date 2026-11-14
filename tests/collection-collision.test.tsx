import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("creating a collection", () => {
  it("reports a name that collides with an existing file", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/notes.md", note, 1_000);
    addFile("Fragments/_fragments-scratchpad.md", note, 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await expect(library.createCollection("notes.md")).rejects.toThrow(/already exists/);
    await expect(library.createCollection("_fragments-scratchpad.md")).rejects.toThrow(
      /already exists/,
    );

    // A free name is still created and listed.
    await library.createCollection("Projects");
    expect(library.collections()).toContain("Projects");
  });
});
