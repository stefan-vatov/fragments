import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const note = (starred: string): string =>
  `---\ntitle: Note\ntags: []\nstarred: ${starred}\nlanguage: "plaintext"\n---\n\nBody.\n`;

const starredFlags = async (starred: string): Promise<boolean[]> => {
  const { app, addFile } = createTestVault();
  addFile("Fragments/Note.md", note(starred), 1_000);
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return library.entries().map((entry) => entry.starred);
};

describe("starred values written by other tools", () => {
  it("accepts the boolean forms", async () => {
    expect(await starredFlags("true")).toEqual([true]);
    expect(await starredFlags("false")).toEqual([false]);
  });

  it("accepts the quoted and YAML-1.1 spellings of true", async () => {
    expect(await starredFlags('"true"')).toEqual([true]);
    expect(await starredFlags("yes")).toEqual([true]);
    expect(await starredFlags("1")).toEqual([true]);
  });

  it("treats quoted false spellings as unstarred", async () => {
    expect(await starredFlags('"false"')).toEqual([false]);
    expect(await starredFlags("no")).toEqual([false]);
    expect(await starredFlags("0")).toEqual([false]);
  });

  it("treats an unparseable value as unstarred", async () => {
    expect(await starredFlags("maybe")).toEqual([false]);
  });
});
