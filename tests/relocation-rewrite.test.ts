import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (body: string) =>
  `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;

const move = (vault: ReturnType<typeof createTestVault>, from: string, to: string): void => {
  const entry = vault.files.get(from);
  if (!entry) throw new Error(`missing ${from}`);
  const text = entry.text;
  vault.files.delete(from);
  vault.addFile(to, text, entry.file.stat.mtime);
};

describe("relocation bookkeeping", () => {
  it("resolves a file that was renamed away and back", async () => {
    const vault = createTestVault();
    vault.addFile("Fragments/A.md", note("Body"), 1_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();

    move(vault, "Fragments/A.md", "Fragments/B.md");
    library.relocate("Fragments/A.md", "Fragments/B.md");
    move(vault, "Fragments/B.md", "Fragments/A.md");
    library.relocate("Fragments/B.md", "Fragments/A.md");

    library.relocation("Fragments/A.md"); // keep the API exercised
    await library.saveBody("Fragments/A.md", "Fresh body");
    expect(vault.files.get("Fragments/A.md")?.text).toContain("Fresh body");
  });

  it("follows a chain of renames", async () => {
    const vault = createTestVault();
    vault.addFile("Fragments/A.md", note("Body"), 1_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();

    move(vault, "Fragments/A.md", "Fragments/B.md");
    library.relocate("Fragments/A.md", "Fragments/B.md");
    move(vault, "Fragments/B.md", "Fragments/C.md");
    library.relocate("Fragments/B.md", "Fragments/C.md");

    await library.saveBody("Fragments/A.md", "Fresh body");
    expect(vault.files.get("Fragments/C.md")?.text).toContain("Fresh body");
  });

  it("drops relocations when the target is removed", async () => {
    const vault = createTestVault();
    vault.addFile("Fragments/A.md", note("Body"), 1_000);
    vault.addFile("Fragments/B.md", note("Other"), 2_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();

    move(vault, "Fragments/A.md", "Fragments/B.md");
    library.relocate("Fragments/A.md", "Fragments/B.md");
    vault.files.delete("Fragments/B.md");
    library.remove("Fragments/B.md");
    expect(library.relocation("Fragments/A.md")).toBeUndefined();

    vault.addFile("Fragments/A.md", note("Recreated"), 3_000);
    await library.load();
    await library.saveBody("Fragments/A.md", "Fresh body");
    expect(vault.files.get("Fragments/A.md")?.text).toContain("Fresh body");
    expect(vault.files.has("Fragments/B.md")).toBe(false);
  });

  it("clears relocations when the library reloads", async () => {
    const vault = createTestVault();
    vault.addFile("Fragments/A.md", note("Body"), 1_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();
    library.relocate("Fragments/A.md", "Fragments/Missing.md");
    await library.load();
    expect(library.relocation("Fragments/A.md")).toBeUndefined();
  });
});
