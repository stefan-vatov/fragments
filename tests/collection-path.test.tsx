import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

describe("collection paths", () => {
  it("nests a slash-separated collection name like create() does", async () => {
    const { app, addFile } = createTestVault();
    addFile("Fragments/existing.md", "---\ntitle: existing\n---\n\nbody\n", 1_000);
    const library = new FragmentLibrary(app, { folder: "Fragments" });
    await library.load();

    await library.createCollection("work/reports");

    expect(app.vault.getAbstractFileByPath("Fragments/work/reports")).not.toBeNull();
    expect(app.vault.getAbstractFileByPath("Fragments/work-reports")).toBeNull();

    const path = await library.create("work/reports");
    expect(path).toBe("Fragments/work/reports/Untitled fragment.md");
    expect(library.collections()).toEqual(["work", "work/reports"]);
  });
});
