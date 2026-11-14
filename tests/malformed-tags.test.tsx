import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: [work, 2024]\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("frontmatter tags", () => {
  it("keeps the valid members when one tag is malformed", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);
    // Obsidian's YAML parser hands back the raw sequence, including the number.
    (app.metadataCache as unknown as { getFileCache: () => unknown }).getFileCache = () => ({
      frontmatter: { title: "Note", tags: ["work", 2024] },
    });

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    expect(library.entries()[0]?.tags).toEqual(["work"]);
  });
});
