import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody\n`;
const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("a permanently failing body read", () => {
  it("gives up after three retries instead of looping forever", async () => {
    const { app, vault, addFile } = createTestVault();
    const file = addFile("Fragments/Note.md", note, 1_000);
    let calls = 0;
    vault.cachedRead = async () => {
      calls += 1;
      throw new Error("unreadable");
    };
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await tick(4_500);
    // Initial read plus three bounded retries, then it stops.
    expect(calls).toBe(4);
    expect(library.indexing("Fragments/Note.md")).toBe(false);

    // A real change retries again.
    vault.cachedRead = async () => {
      calls += 1;
      return "Recovered body";
    };
    await library.refresh(file);
    expect(calls).toBe(5);
    expect(library.entries()[0]?.preview).toContain("Recovered body");
  });
});
