import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string, body: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;

describe("loading the library twice", () => {
  it("re-reads only the bodies whose file changed", async () => {
    const { app, vault, files, addFile } = createTestVault();
    addFile("Fragments/A.md", note("A", "alpha body"), 1_000);
    addFile("Fragments/B.md", note("B", "beta body"), 2_000);

    let reads = 0;
    const original = vault.cachedRead;
    vault.cachedRead = async (file) => {
      reads += 1;
      return original(file);
    };

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    expect(reads).toBe(2);

    // A folder switch or an unrelated folder rename reloads the same files.
    reads = 0;
    await library.load();
    expect(reads).toBe(0);
    // The cached bodies still feed previews and body search.
    expect(library.entries().find((item) => item.path === "Fragments/A.md")?.preview).toContain(
      "alpha body",
    );

    // One file changed: only that body is read again.
    const entry = files.get("Fragments/B.md");
    expect(entry).not.toBeUndefined();
    if (entry) {
      entry.text = note("B", "beta changed");
      entry.file.stat.mtime += 1_000;
    }
    reads = 0;
    await library.load();
    expect(reads).toBe(1);
    expect(library.entries().find((item) => item.path === "Fragments/B.md")?.preview).toContain(
      "beta changed",
    );
  });
});
