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

    expect(next).toBe("Fragments/a-b (1).md");
    expect(files.get("Fragments/a-b.md")?.text).toContain('title: "a-b"');
    expect(files.get(next)?.text).toContain('title: "a/b"');
    expect(library.entries().find((entry) => entry.path === next)?.title).toBe("a/b");
  });

  it("suffixes a duplicate title without modifying the existing fragment", async () => {
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/a-b.md", note("a-b"), 2_000);
    addFile("Fragments/keep.md", note("keep"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const original = files.get("Fragments/a-b.md")?.text;
    const next = await library.rename("Fragments/keep.md", "a-b");
    expect(next).toBe("Fragments/a-b (1).md");
    expect(files.get(next)?.text).toContain('title: "a-b (1)"');
    expect(files.get(next)?.text).toContain("keep body.");
    expect(files.get("Fragments/a-b.md")?.text).toBe(original);
  });

  it("uses the first available counter across collections", async () => {
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Other/Name.md", note("Name"));
    addFile("Fragments/Other/Name (1).md", note("Name (1)"));
    addFile("Fragments/Other/Name (3).md", note("Name (3)"));
    addFile("Fragments/Target/keep.md", note("keep"));
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const next = await library.rename("Fragments/Target/keep.md", "Name");
    expect(next).toBe("Fragments/Target/Name (2).md");
    expect(files.get(next)?.text).toContain('title: "Name (2)"');
    expect(files.get("Fragments/Other/Name.md")?.text).toBe(note("Name"));
    expect(files.get("Fragments/Other/Name (1).md")?.text).toBe(note("Name (1)"));
    expect(files.get("Fragments/Other/Name (3).md")?.text).toBe(note("Name (3)"));
  });

  it("moves a duplicate into a folder without overwriting the existing fragment", async () => {
    const { app, files, addFile } = createTestVault();
    const source = note("Name").replace("Name body.", "Source body.");
    addFile("Fragments/Source/Name.md", source);
    addFile("Fragments/Target/Name.md", note("Name"));
    addFile("Fragments/Target/Name (1).md", note("Name (1)"));
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const next = await library.move("Fragments/Source/Name.md", "Target");
    expect(next).toBe("Fragments/Target/Name (2).md");
    expect(files.get(next)?.text).toContain('title: "Name (2)"');
    expect(files.get(next)?.text).toContain("Source body.");
    expect(files.get("Fragments/Target/Name.md")?.text).toBe(note("Name"));
    expect(files.get("Fragments/Target/Name (1).md")?.text).toBe(note("Name (1)"));
  });

  it("disambiguates a colliding filename without changing a distinct title", async () => {
    const { app, files, addFile } = createTestVault();
    addFile("Fragments/Source/a-b.md", note("a/b"));
    addFile("Fragments/Target/a-b.md", note("a-b"));
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    const next = await library.move("Fragments/Source/a-b.md", "Target");
    expect(next).toBe("Fragments/Target/a-b (1).md");
    expect(files.get(next)?.text).toBe(note("a/b"));
    expect(files.get("Fragments/Target/a-b.md")?.text).toBe(note("a-b"));
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
