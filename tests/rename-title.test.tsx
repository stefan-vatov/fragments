import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string): string =>
  `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body.\n`;

describe("rename title identity", () => {
  it("renames to a title whose sanitised filename belongs to another title", async () => {
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/a-b.md", note("a-b"), 2_000);
    addFile("Fragments/keep.md", note("keep"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const next = await library.rename("Fragments/keep.md", "a/b");

    expect(next).toBe("Fragments/a-b 2.md");
    expect(files.get("Fragments/a-b.md")?.text).toContain('title: "a-b"');
    expect(files.get(next)?.text).toContain('title: "a/b"');
    expect(library.entries().find((entry) => entry.path === next)?.title).toBe("a/b");
  });

  it("still refuses a title another fragment actually holds", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/a-b.md", note("a-b"), 2_000);
    addFile("Fragments/keep.md", note("keep"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await expect(library.rename("Fragments/keep.md", "a-b")).rejects.toThrow(
      "A fragment with that title already exists.",
    );
  });

  it("keeps title and filename aligned for a plain rename", async () => {
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/keep.md", note("keep"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const next = await library.rename("Fragments/keep.md", "notes");

    expect(next).toBe("Fragments/notes.md");
    expect(files.get(next)?.text).toContain('title: "notes"');
    expect(library.entries().find((entry) => entry.path === next)?.title).toBe("notes");
  });
});
