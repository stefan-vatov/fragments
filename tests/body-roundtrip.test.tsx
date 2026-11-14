import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const withSeparator = (separator: string, body: string): string =>
  `---\ntitle: A\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n${separator}${body}\n`;

describe("frontmatter/body separator", () => {
  it("does not insert a blank line into a note that had none", async () => {
    const { app, addFile, files } = createTestVault();
    addFile("Fragments/A.md", withSeparator("", "body"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await library.saveBody("Fragments/A.md", "body");

    const text = files.get("Fragments/A.md")?.text ?? "";
    expect(text).not.toContain("---\n\nbody");
    expect(await library.read("Fragments/A.md")).toBe("body");
  });

  it("keeps the blank line a note already had", async () => {
    const { app, addFile, files } = createTestVault();
    addFile("Fragments/A.md", withSeparator("\n", "body"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await library.saveBody("Fragments/A.md", "body");

    expect(files.get("Fragments/A.md")?.text).toContain("---\n\nbody");
    expect(await library.read("Fragments/A.md")).toBe("body");
  });

  it("is idempotent when saved twice", async () => {
    const { app, addFile, files } = createTestVault();
    addFile("Fragments/A.md", withSeparator("", "first"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await library.saveBody("Fragments/A.md", "first");
    const once = files.get("Fragments/A.md")?.text;
    await library.saveBody("Fragments/A.md", "first");
    expect(files.get("Fragments/A.md")?.text).toBe(once);
    expect(await library.read("Fragments/A.md")).toBe("first");
  });
});
