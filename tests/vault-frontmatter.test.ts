import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const load = async (text: string) => {
  const { app, addFile } = createTestVault();
  addFile("Fragments/Note.md", text, 1_000);
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return { library, app };
};

describe("frontmatter shapes", () => {
  it("reads block-sequence tags", async () => {
    const { library } = await load(
      `---\ntitle: Note\ntags:\n  - alpha\n  - beta\nstarred: false\nlanguage: "plaintext"\n---\n\nBody\n`,
    );
    expect(library.entries()[0]?.tags).toEqual(["alpha", "beta"]);
  });

  it("keeps commas inside quoted tags", async () => {
    const { library } = await load(
      `---\ntitle: Note\ntags: ["alpha, beta", gamma]\nstarred: false\nlanguage: "plaintext"\n---\n\nBody\n`,
    );
    expect(library.entries()[0]?.tags).toEqual(["alpha, beta", "gamma"]);
  });

  it("keeps a quoted title with a comma", async () => {
    const { library } = await load(
      `---\ntitle: "Hello, world"\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody\n`,
    );
    expect(library.entries()[0]?.title).toBe("Hello, world");
  });

  it("round-trips tags whose values contain commas", async () => {
    const { library } = await load(
      `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody\n`,
    );
    await library.updateProperties("Fragments/Note.md", { tags: ["alpha, beta", "gamma"] });
    expect(library.entries()[0]?.tags).toEqual(["alpha, beta", "gamma"]);
  });
});
