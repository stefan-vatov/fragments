import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const library = async () => {
  const { app, addFile, vault } = createTestVault();
  addFile("Fragments/Note.md", `---\ntitle: Note\n---\n\nBody.\n`, 1_000);
  const fragmentLibrary = new FragmentLibrary(app, { folder: "Fragments" });
  await fragmentLibrary.load();
  return { fragmentLibrary, vault };
};

describe("collection names", () => {
  it("rejects dot and dot-dot segments instead of creating traversal paths", async () => {
    const { fragmentLibrary, vault } = await library();

    await expect(fragmentLibrary.createCollection("..")).rejects.toThrow(/segments/);
    await expect(fragmentLibrary.createCollection("a/../b")).rejects.toThrow(/segments/);
    await expect(fragmentLibrary.createCollection(".")).rejects.toThrow(/segments/);

    expect(vault.getAbstractFileByPath("Fragments/..")).toBeNull();
    expect(vault.getAbstractFileByPath("Fragments/a")).toBeNull();
    expect(fragmentLibrary.collections()).toEqual([]);
  });

  it("still creates ordinary nested collections", async () => {
    const { fragmentLibrary, vault } = await library();

    await fragmentLibrary.createCollection("work/reports");

    expect(vault.getAbstractFileByPath("Fragments/work/reports")).not.toBeNull();
    expect(fragmentLibrary.collections()).toEqual(["work", "work/reports"]);
  });

  it("still rejects an empty name", async () => {
    const { fragmentLibrary } = await library();

    await expect(fragmentLibrary.createCollection("   ")).rejects.toThrow(/collection name/);
  });
});
