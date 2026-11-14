import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const PAD = "Fragments/_fragments-scratchpad.md";

describe("reading the scratchpad", () => {
  it("waits for a save that is already queued for the same path", async () => {
    const { app, vault, addFile } = createTestVault();
    addFile(PAD, "old text");
    const library = new FragmentLibrary(app, { folder: "Fragments" });

    let releaseProcess!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseProcess = resolve;
    });
    const original = vault.process;
    vault.process = async (file, fn) => {
      await gate;
      return original(file, fn);
    };

    const save = library.saveScratchpad(PAD, "new text", "old text");
    const read = library.readScratchpad(PAD);

    // Let the read run while the save is still blocked on the gate.
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseProcess();

    // A reader that does not wait would have adopted "old text" as its baseline.
    expect(await read).toBe("new text");
    await save;
    expect(await library.readScratchpad(PAD)).toBe("new text");
  });
});
