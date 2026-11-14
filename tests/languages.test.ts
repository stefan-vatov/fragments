import { describe, expect, it, vi } from "vitest";
import { findLanguage, highlightCode, LanguageSuggest, languageLabel } from "../src/languages";

describe("language lookup", () => {
  it("resolves ids, labels and aliases", () => {
    expect(findLanguage("typescript")?.id).toBe("typescript");
    expect(findLanguage("TypeScript")?.id).toBe("typescript");
    expect(findLanguage("ts")?.id).toBe("typescript");
    expect(findLanguage("  MD ")?.id).toBe("markdown");
    expect(findLanguage("txt")?.id).toBe("plaintext");
  });

  it("treats empty and unknown values as no choice", () => {
    expect(findLanguage("")).toBeUndefined();
    expect(findLanguage("   ")).toBeUndefined();
    expect(findLanguage("not-a-language")).toBeUndefined();
  });

  it("falls back to the raw value for labels", () => {
    expect(languageLabel("ts")).toBe("TypeScript");
    expect(languageLabel("not-a-language")).toBe("not-a-language");
  });
});

describe("highlighting", () => {
  it("resets stale highlighting state", () => {
    const element = document.createElement("code");
    element.className = "language-rust hljs";
    element.setAttribute("data-highlighted", "yes");
    highlightCode(element, "plain text", "plaintext");
    expect(element.textContent).toBe("plain text");
    expect(element.className).toBe("");
    expect(element.hasAttribute("data-highlighted")).toBe(false);
  });

  it("leaves unknown languages unhighlighted", () => {
    const element = document.createElement("code");
    highlightCode(element, "const x = 1;", "not-a-language");
    expect(element.className).toBe("");
    expect(element.innerHTML).not.toContain("hljs-");
  });

  it("highlights a known language", () => {
    const element = document.createElement("code");
    highlightCode(element, "const answer: number = 42;", "typescript");
    expect(element.classList.contains("language-typescript")).toBe(true);
    expect(element.innerHTML).toContain("hljs-");
  });
});

describe("language suggestions", () => {
  const create = () => {
    const choose = vi.fn();
    const input = document.createElement("input");
    const suggest = new LanguageSuggest({} as never, input, choose);
    const results = (query: string): string[] =>
      (suggest as unknown as { getSuggestions: (value: string) => Array<{ id: string }> })
        .getSuggestions(query)
        .map((choice) => choice.id);
    return { suggest, choose, results };
  };

  it("ranks prefix matches before contains matches", () => {
    const { results } = create();
    expect(results("typ")[0]).toBe("typescript");
    expect(results("script")).toContain("typescript");
  });

  it("selects a suggestion by writing the label and calling back", () => {
    const { suggest, choose } = create();
    const setValue = vi.spyOn(suggest, "setValue");
    (suggest as unknown as { selectSuggestion: (choice: unknown) => void }).selectSuggestion(
      findLanguage("ts"),
    );
    expect(setValue).toHaveBeenCalledWith("TypeScript");
    expect(choose).toHaveBeenCalled();
  });
});
