import { describe, expect, it } from "vitest";
import type { Fragment } from "../src/library";
import { indexFragments, matchScore, searchFragments } from "../src/search";

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

describe("ranking thresholds", () => {
  it("ranks prefix above contiguous above subsequence", () => {
    const prefix = fragment({ path: "Fragments/Prefix.md", title: "Alpha" });
    const contiguous = fragment({ path: "Fragments/Contiguous.md", title: "Balph" });
    const subsequence = fragment({ path: "Fragments/Sub.md", title: "Axxl" });
    const results = searchFragments(indexFragments([subsequence, contiguous, prefix]), {
      query: "al",
    });
    expect(results.map((item) => item.title)).toEqual(["Alpha", "Balph", "Axxl"]);
  });

  it("scores a field on its own, with -1 for no match", () => {
    expect(matchScore("Alpha", "al")).toBeGreaterThan(matchScore("Balph", "al"));
    expect(matchScore("Balph", "al")).toBeGreaterThan(matchScore("Axxl", "al"));
    expect(matchScore("Alpha", "")).toBe(0);
    expect(matchScore("Alpha", "zz")).toBe(-1);
  });
});

describe("scopes", () => {
  const starred = fragment({ path: "Fragments/Starred.md", title: "Starred", starred: true });
  const fresh = fragment({
    path: "Fragments/Fresh.md",
    title: "Fresh",
    modified: 40 * 86_400_000,
  });
  const stale = fragment({
    path: "Fragments/Stale.md",
    title: "Stale",
    modified: 20 * 86_400_000,
  });
  const nested = fragment({
    path: "Fragments/Nested.md",
    title: "Nested",
    collection: "Work/Deep",
  });
  const home = fragment({ path: "Fragments/Home.md", title: "Home", collection: "Home" });

  it("keeps only starred fragments", () => {
    const results = searchFragments(indexFragments([starred, home]), {
      query: "",
      scope: { kind: "starred" },
    });
    expect(results.map((item) => item.title)).toEqual(["Starred"]);
  });

  it("keeps fragments modified in the last 30 days", () => {
    const results = searchFragments(indexFragments([fresh, stale]), {
      query: "",
      scope: { kind: "recent" },
      now: 60 * 86_400_000,
    });
    expect(results.map((item) => item.title)).toEqual(["Fresh"]);
  });

  it("matches nested collections", () => {
    const results = searchFragments(indexFragments([nested, home]), {
      query: "",
      scope: { kind: "collection", value: "Work" },
    });
    expect(results.map((item) => item.title)).toEqual(["Nested"]);
  });
});

describe("body search and limits", () => {
  it("only searches the body when asked", () => {
    const withBody = fragment({
      path: "Fragments/Body.md",
      title: "Body",
      searchText: "a special token",
    });
    const without = searchFragments(indexFragments([withBody]), { query: "special" });
    expect(without).toEqual([]);
    const withMatch = searchFragments(indexFragments([withBody]), {
      query: "special",
      includeBody: true,
    });
    expect(withMatch.map((item) => item.title)).toEqual(["Body"]);
  });

  it("returns the best matches up to the limit", () => {
    const best = fragment({ path: "Fragments/Best.md", title: "Alpha" });
    const middle = fragment({ path: "Fragments/Middle.md", title: "Balph" });
    const worst = fragment({ path: "Fragments/Worst.md", title: "Axxl" });
    const results = searchFragments(indexFragments([worst, middle, best]), {
      query: "al",
      limit: 2,
    });
    expect(results.map((item) => item.title)).toEqual(["Alpha", "Balph"]);
  });
});
