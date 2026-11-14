import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string): string =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body.\n`;

const setup = async () => {
  const { app, addFile } = createTestVault();
  addFile("Fragments/Alpha.md", note("Alpha"), 1_000);
  addFile("Other/Beta.md", note("Beta"), 1_000);
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return library;
};

describe("changing to the folder that is already active", () => {
  it("does not reload when the resolved folder is unchanged", async () => {
    const library = await setup();
    const revision = library.snapshot();

    await library.changeFolder("Fragments ");
    await library.changeFolder("fragments");
    await library.changeFolder("Fragments");

    // A no-op must not clear and re-read the library.
    expect(library.snapshot()).toBe(revision);
    expect(library.entries().map((entry) => entry.title)).toEqual(["Alpha"]);
  });

  it("still reloads for a genuinely different folder", async () => {
    const library = await setup();
    const revision = library.snapshot();

    await library.changeFolder("Other");

    expect(library.snapshot()).toBeGreaterThan(revision);
    expect(library.entries().map((entry) => entry.title)).toEqual(["Beta"]);
  });
});
