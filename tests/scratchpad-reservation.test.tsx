import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const setup = async (files: [string, string][]) => {
  const { app, addFile, files: registry } = createTestVault();
  for (const [path, title] of files) addFile(path, note(title), 1_000);
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return { library, files: registry };
};

describe("reserved scratchpad path", () => {
  it("still refuses the title when the pad path is free", async () => {
    const { library } = await setup([["Fragments/Alpha.md", "Alpha"]]);

    await expect(library.rename("Fragments/Alpha.md", "_fragments-scratchpad")).rejects.toThrow(
      /reserved/,
    );
  });

  it("allows it when de-duplication would suffix the title anyway", async () => {
    const { library, files } = await setup([
      ["Fragments/Alpha.md", "Alpha"],
      ["Fragments/Notes/Scratch.md", "_fragments-scratchpad"],
    ]);

    const next = await library.rename("Fragments/Alpha.md", "_fragments-scratchpad");

    expect(next).toBe("Fragments/_fragments-scratchpad (1).md");
    expect(files.get(next)?.text).toContain('title: "_fragments-scratchpad (1)"');
    expect(library.entries().find((entry) => entry.path === next)?.title).toBe(
      "_fragments-scratchpad (1)",
    );
  });

  it("refuses a move whose final path would be the pad file", async () => {
    const { library, files } = await setup([
      ["Fragments/Notes/_fragments-scratchpad.md", "Notes pad"],
    ]);

    await expect(library.move("Fragments/Notes/_fragments-scratchpad.md", "")).rejects.toThrow(
      /reserved/,
    );
    expect(files.has("Fragments/Notes/_fragments-scratchpad.md")).toBe(true);
  });
});
