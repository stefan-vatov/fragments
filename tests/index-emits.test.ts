import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (title: string) =>
  `---\ntitle: ${title}\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${title} body\n`;

describe("load notifications", () => {
  it("emits once for metadata and once when the bodies are indexed", async () => {
    const { app, addFile } = createTestVault();
    for (let index = 0; index < 130; index += 1)
      addFile(`Fragments/Note ${index}.md`, note(`Note ${index}`), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    let emits = 0;
    library.subscribe(() => {
      emits += 1;
    });
    await library.load();
    // One emit shows the metadata pass, one shows the finished body index; a
    // per-batch emit would make the app recompute search and counts each time.
    expect(emits).toBe(2);
  });
});
