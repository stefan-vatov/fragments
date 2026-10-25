import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { indexFragments, searchFragments } from "../src/search";
import { createTestVault } from "./vault";

const note = (body: string): string =>
  `---\ntitle: "Alpha"\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;

describe("body index ordering", () => {
  it("keeps the newest body when reads resolve out of order", async () => {
    const { app, vault, files, addFile } = createTestVault();
    const alpha = addFile("Fragments/Alpha.md", note("ORIGINAL"), 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();
    expect(library.entries()[0]?.preview).toContain("ORIGINAL");

    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let reads = 0;
    vault.cachedRead = async (file) => {
      // Snapshot at call time, exactly like a real read.
      const snapshot = files.get(file.path)?.text ?? "";
      reads += 1;
      if (reads === 1) await firstGate;
      return snapshot;
    };

    const entry = files.get("Fragments/Alpha.md");
    expect(entry).toBeDefined();

    entry!.text = note("EDITED-1");
    const first = library.refresh(alpha);
    entry!.text = note("EDITED-2");
    await library.refresh(alpha);

    expect(library.entries()[0]?.preview).toContain("EDITED-2");

    // The older read was issued for EDITED-1 and finishes last.
    releaseFirst?.();
    await first;

    const [indexed] = library.entries();
    expect(indexed?.preview).toContain("EDITED-2");
    expect(indexed?.searchText).toContain("edited-2");
    expect(indexed?.searchText).not.toContain("edited-1");
    expect(
      searchFragments(indexFragments(library.entries()), {
        query: "EDITED-2",
        includeBody: true,
      }).map((fragment) => fragment.path),
    ).toContain("Fragments/Alpha.md");
  });
});
