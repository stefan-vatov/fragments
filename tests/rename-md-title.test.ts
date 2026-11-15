import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

describe("renaming with a .md suffix in the title", () => {
  it("does not double the file extension", async () => {
    const vault = createTestVault();
    vault.addFile("Fragments/Start.md", note("Start"), 1_000);
    vault.addFile("Fragments/Other.md", note("Other"), 2_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();

    const next = await library.rename("Fragments/Start.md", "Notes.md");
    expect(next).toBe("Fragments/Notes.md");
    expect(vault.files.has("Fragments/Notes.md")).toBe(true);
    expect(vault.files.has("Fragments/Notes.md.md")).toBe(false);
    expect(library.entries().find((item) => item.path === next)?.title).toBe("Notes");
  });

  it("strips the suffix case-insensitively", async () => {
    const vault = createTestVault();
    vault.addFile("Fragments/Start.md", note("Start"), 1_000);
    const library = new FragmentLibrary(vault.app, { folder: "Fragments" });
    await library.load();

    const next = await library.rename("Fragments/Start.md", "Plan.MD");
    expect(next).toBe("Fragments/Plan.md");
    expect(library.entries().find((item) => item.path === next)?.title).toBe("Plan");
  });
});
