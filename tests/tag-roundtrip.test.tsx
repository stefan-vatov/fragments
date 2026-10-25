import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (tags: string): string =>
  `---\ntitle: "Note"\ntags: ${tags}\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const load = async (tags: string): Promise<FragmentLibrary> => {
  const { app, addFile } = createTestVault();
  addFile("Fragments/Note.md", note(tags));
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return library;
};

describe("frontmatter tag parsing", () => {
  it("keeps a whitespace tag intact when reading a scalar", async () => {
    const library = await load("work notes");
    expect(library.entries()[0]?.tags).toEqual(["work notes"]);
  });

  it("round-trips a whitespace tag through the write path", async () => {
    const library = await load("work notes");
    await library.updateProperties("Fragments/Note.md", { tags: ["work notes"] });
    expect(library.entries()[0]?.tags).toEqual(["work notes"]);
  });

  it("still splits comma-separated scalar tags and strips the leading hash", async () => {
    const library = await load("work, #notes");
    expect(library.entries()[0]?.tags).toEqual(["work", "notes"]);
  });
});
