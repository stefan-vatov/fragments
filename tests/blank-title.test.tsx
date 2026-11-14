import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const load = async (files: [string, string][]): Promise<FragmentLibrary> => {
  const { app, addFile } = createTestVault();
  for (const [path, text] of files) addFile(path, text);
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return library;
};

describe("blank frontmatter titles", () => {
  it("falls back to the file name so every fragment stays addressable", async () => {
    const library = await load([
      ["Fragments/Alpha.md", note("")],
      ["Fragments/Beta.md", note("   ")],
    ]);

    expect(
      library
        .entries()
        .map((entry) => entry.title)
        .sort(),
    ).toEqual(["Alpha", "Beta"]);
  });

  it("keeps a non-blank title exactly as written, including surrounding spaces", async () => {
    const library = await load([["Fragments/Alpha.md", note("  Keep me  ")]]);

    expect(library.entries()[0]?.title).toBe("  Keep me  ");
  });

  it("still uses the frontmatter title when the file name differs", async () => {
    const library = await load([["Fragments/keep.md", note("Displayed name")]]);

    expect(library.entries()[0]?.title).toBe("Displayed name");
  });
});
