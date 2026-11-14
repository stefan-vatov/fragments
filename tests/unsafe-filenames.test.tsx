import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody.\n`;

const setup = async () => {
  const { app, files, addFile } = createTestVault();
  addFile("Fragments/Alpha.md", note("Alpha"), 1_000);
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return { library, files };
};

describe("rename sanitisation", () => {
  it("replaces control characters in the file name", async () => {
    const { library, files } = await setup();
    await library.rename("Fragments/Alpha.md", "line\nbreak");
    expect([...files.keys()]).toEqual(["Fragments/line break.md"]);
  });

  it("drops a trailing dot before the extension", async () => {
    const { library, files } = await setup();
    await library.rename("Fragments/Alpha.md", "a.");
    expect([...files.keys()]).toEqual(["Fragments/a.md"]);
  });

  it("prefixes Windows device names", async () => {
    const { library, files } = await setup();
    await library.rename("Fragments/Alpha.md", "CON");
    expect([...files.keys()]).toEqual(["Fragments/_CON.md"]);
  });

  it("keeps ordinary titles unchanged", async () => {
    const { library, files } = await setup();
    await library.rename("Fragments/Alpha.md", "A normal title");
    expect([...files.keys()]).toEqual(["Fragments/A normal title.md"]);
  });
});
