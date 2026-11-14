import { describe, expect, it } from "vitest";
import { FragmentLibrary } from "../src/library";
import { createTestVault } from "./vault";

const bodyNote = (body: string): string =>
  `---\ntitle: Note\ntags: []\nstarred: false\nlanguage: "plaintext"\n---\n\n${body}\n`;

const preview = async (body: string): Promise<string> => {
  const { app, addFile } = createTestVault();
  addFile("Fragments/Note.md", bodyNote(body), 1_000);
  const library = new FragmentLibrary(app, { folder: "Fragments" });
  await library.load();
  return library.entries()[0]?.preview ?? "";
};

describe("list previews", () => {
  it("keeps a link label without leaking its target", async () => {
    expect(await preview("see [docs](https://example.com/a)")).toBe("see docs");
  });

  it("keeps an image alt text without the target", async () => {
    expect(await preview("![diagram](assets/diagram.png)")).toBe("diagram");
  });

  it("drops raw HTML tags", async () => {
    expect(await preview("<div>after<br>the break</div>")).toBe("after the break");
  });

  it("drops list and quote markers", async () => {
    expect(await preview("- first\n- second\n> quoted")).toBe("first second quoted");
  });

  it("drops emphasis and strikethrough markers", async () => {
    expect(await preview("**bold** and ~~gone~~ and _italic_")).toBe("bold and gone and italic");
  });

  it("still collapses whitespace and caps the length", async () => {
    const text = await preview(`${"word ".repeat(60)}tail`);
    expect(text.length).toBeLessThanOrEqual(140);
    expect(text.startsWith("word word")).toBe(true);
  });
});
