import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\nBody text here.\n`;

describe("a transient body-index failure", () => {
  it("is retried instead of leaving the preview empty", async () => {
    const { app, vault, addFile } = createTestVault();
    addFile("Fragments/Note.md", note, 1_000);

    let failures = 1;
    const original = vault.cachedRead;
    vault.cachedRead = async (file) => {
      if (failures > 0) {
        failures -= 1;
        throw new Error("temporary read failure");
      }
      return original(file);
    };

    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    expect(library.entries()[0]?.preview).toBe("");

    await new Promise((resolve) => setTimeout(resolve, 1_300));
    expect(library.entries()[0]?.preview).toContain("Body text here.");
  });
});
