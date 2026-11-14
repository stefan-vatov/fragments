import { describe, expect, it, vi } from "vitest";
import { FolderSuggest } from "../src/folder-suggest";

interface Folder {
  path: string;
}

const folder = (path: string): Folder => ({ path });

const create = () => {
  const app = {
    vault: {
      getAllFolders: (): Folder[] => [
        folder("Fragments"),
        folder("Fragments/Work"),
        folder("Archive"),
        folder("Archive/Fragments"),
      ],
    },
  };
  const input = document.createElement("input");
  const choose = vi.fn();
  const suggest = new FolderSuggest(app as never, input, choose);
  const results = (query: string): string[] =>
    (suggest as unknown as { getSuggestions: (value: string) => Folder[] })
      .getSuggestions(query)
      .map((entry) => entry.path);
  return { suggest, choose, results };
};

describe("folder suggestions", () => {
  it("ranks prefix matches before contains matches", () => {
    expect(create().results("frag")).toEqual(["Fragments", "Fragments/Work", "Archive/Fragments"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(create().results("  FRAG ")).toEqual([
      "Fragments",
      "Fragments/Work",
      "Archive/Fragments",
    ]);
  });

  it("returns every folder for an empty query", () => {
    expect(create().results("")).toEqual([
      "Fragments",
      "Fragments/Work",
      "Archive",
      "Archive/Fragments",
    ]);
  });

  it("renders the full folder path", () => {
    const { suggest } = create();
    const element = document.createElement("div");
    (
      suggest as unknown as {
        renderSuggestion: (entry: Folder, node: HTMLElement) => void;
      }
    ).renderSuggestion(folder("Archive/Fragments"), element);
    expect(element.textContent).toBe("Archive/Fragments");
  });

  it("selects a suggestion by writing the value and calling back", () => {
    const { suggest, choose } = create();
    const setValue = vi.spyOn(suggest, "setValue");
    const close = vi.spyOn(suggest, "close");
    (suggest as unknown as { selectSuggestion: (entry: Folder) => void }).selectSuggestion(
      folder("Fragments/Work"),
    );
    expect(setValue).toHaveBeenCalledWith("Fragments/Work");
    expect(close).toHaveBeenCalled();
    expect(choose).toHaveBeenCalledWith("Fragments/Work");
  });
});
