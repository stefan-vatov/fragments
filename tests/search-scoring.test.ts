import { describe, expect, it } from "vitest";
import type { Fragment } from "../src/library";
import { indexFragments, searchFragments } from "../src/search";

const fragment = (patch: Partial<Fragment> & { path: string }): Fragment => ({
  title: patch.path,
  collection: "",
  tags: [],
  starred: false,
  language: "plaintext",
  modified: 1_000,
  preview: "",
  searchText: "",
  ...patch,
});

const alpha = fragment({
  path: "Fragments/Alpha.md",
  title: "Alpha",
  tags: ["work"],
  modified: 2_000,
});
const beta = fragment({
  path: "Fragments/Beta.md",
  title: "Beta",
  tags: ["home"],
  modified: 1_000,
});

describe("searchFragments", () => {
  it("ranks a title match first", () => {
    const results = searchFragments(indexFragments([beta, alpha]), { query: "alpha" });
    expect(results.map((item) => item.path)).toEqual(["Fragments/Alpha.md"]);
  });

  it("filters by tag scope", () => {
    const results = searchFragments(indexFragments([alpha, beta]), {
      query: "",
      scope: { kind: "tag", value: "home" },
    });
    expect(results.map((item) => item.path)).toEqual(["Fragments/Beta.md"]);
  });

  it("sorts by name when asked", () => {
    const results = searchFragments(indexFragments([alpha, beta]), {
      query: "",
      sort: "name",
    });
    expect(results.map((item) => item.title)).toEqual(["Alpha", "Beta"]);
  });
});
