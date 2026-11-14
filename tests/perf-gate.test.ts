import { describe, expect, it } from "vitest";
import type { Fragment } from "../src/library";
import { highlightCode } from "../src/languages";
import { indexFragments, searchFragments } from "../src/search";

const fragment = (index: number): Fragment => ({
  path: `Fragments/Note ${index}.md`,
  title: `Note ${index}`,
  collection: index % 2 ? "Work" : "Home",
  tags: index % 3 ? ["work"] : [],
  starred: false,
  language: "plaintext",
  modified: 1_000 + index,
  preview: "",
  searchText: `Note ${index} body text${index % 7 === 0 ? " needle" : ""}`,
});

describe("performance gates", () => {
  it("searches a large library within a generous budget", () => {
    const entries = Array.from({ length: 5_000 }, (_, index) => fragment(index));
    const index = indexFragments(entries);
    const started = performance.now();
    const results = searchFragments(index, { query: "needle", includeBody: true });
    const elapsed = performance.now() - started;
    expect(results.length).toBeGreaterThan(0);
    // Generous enough for a loaded CI runner while still catching an accidental
    // O(n²) change in the search path.
    expect(elapsed).toBeLessThan(1_500);
  });

  it("highlights a long body within a generous budget", () => {
    const element = document.createElement("code");
    const body = "const value = 42;\n".repeat(1_000);
    const started = performance.now();
    highlightCode(element, body, "typescript");
    const elapsed = performance.now() - started;
    expect(element.innerHTML).toContain("hljs-");
    expect(elapsed).toBeLessThan(1_500);
  });
});
