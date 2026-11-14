import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { indexFragments, searchFragments } from "../src/search";
import { createTestVault } from "./vault";

const day = 86_400_000;

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body\n`;

const modified = (library: FragmentLibrary, name: string): number | undefined =>
  library.entries().find((entry) => entry.path.endsWith(`${name}.md`))?.modified;

describe("property writes and recency", () => {
  it("keeps the old edited time when only properties change", async () => {
    const { app, addFile } = createTestVault();
    const old = Date.now() - 10 * day;
    addFile("Fragments/Alpha.md", note("Alpha"), old);
    addFile("Fragments/Beta.md", note("Beta"), Date.now() - 1 * day);
    // Obsidian bumps the file's mtime on any write; simulate that.
    const fileManager = app.fileManager as unknown as {
      processFrontMatter: (
        file: { stat: { mtime: number } },
        fn: (data: object) => void,
      ) => Promise<void>;
    };
    const original = fileManager.processFrontMatter;
    fileManager.processFrontMatter = async (file, fn) => {
      await original(file, fn);
      file.stat.mtime = Date.now();
    };

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    const recent = (): string[] =>
      searchFragments(indexFragments(library.entries()), { query: "" }).map((entry) => entry.title);
    expect(recent()).toEqual(["Beta", "Alpha"]);

    await library.updateProperties("Fragments/Alpha.md", { starred: true });

    expect(modified(library, "Alpha")).toBe(old);
    expect(recent()).toEqual(["Beta", "Alpha"]);
    expect(library.entries().find((entry) => entry.title === "Alpha")?.starred).toBe(true);
  });

  it("records a body save as the new edited time", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/Alpha.md", note("Alpha"), Date.now() - 10 * day);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await library.saveBody("Fragments/Alpha.md", "Fresh body");

    expect(modified(library, "Alpha")).toBeGreaterThan(Date.now() - 60_000);
    expect(library.entries()[0]?.preview).toContain("Fresh body");
  });
});
