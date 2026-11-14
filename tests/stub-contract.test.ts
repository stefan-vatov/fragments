import { describe, expect, it } from "vitest";
import { Component, getFrontMatterInfo, MarkdownRenderer, Platform } from "obsidian";
import { createTestVault } from "./vault";

const note = `---\ntitle: Note\ntags: [work]\n---\n\nBody text\n`;

describe("obsidian stub contracts", () => {
  it("exposes the platform flags production code reads", () => {
    expect(Platform.isMacOS).toBe(false);
    expect(Platform.isDesktopApp).toBe(false);
  });

  it("leaves the file untouched when a process callback throws", async () => {
    const { vault, addFile, files } = createTestVault();
    const file = addFile("Fragments/Note.md", note, 1_000);
    await expect(
      vault.process(file, () => {
        throw new Error("rejected");
      }),
    ).rejects.toThrow("rejected");
    expect(files.get("Fragments/Note.md")?.text).toBe(note);
  });

  it("reads the current text after a write", async () => {
    const { vault, addFile } = createTestVault();
    const file = addFile("Fragments/Note.md", note, 1_000);
    await vault.process(file, () => "changed");
    expect(await vault.read(file)).toBe("changed");
    expect(await vault.cachedRead(file)).toBe("changed");
  });

  it("locates the body after the frontmatter", () => {
    const info = getFrontMatterInfo(note);
    expect(info.exists).toBe(true);
    // contentStart points at the blank separator line, as saveBody assumes.
    expect(note.slice(info.contentStart).trimStart()).toBe("Body text\n");
    expect(getFrontMatterInfo("Body only").exists).toBe(false);
  });

  it("renders markdown without touching the element", async () => {
    const element = document.createElement("div");
    await MarkdownRenderer.render(
      {} as never,
      "# Title",
      element,
      "Fragments/Note.md",
      new Component(),
    );
    expect(element.innerHTML).toBe("");
  });
});
