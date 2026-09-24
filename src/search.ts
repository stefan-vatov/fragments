import type { Fragment } from "./library";

export type SearchScope = {
  kind: "all" | "starred" | "recent" | "collection" | "tag";
  value?: string;
};

interface SearchEntry {
  fragment: Fragment;
  title: string;
  collection: string;
  tags: string[];
}

interface RankedFragment {
  fragment: Fragment;
  score: number;
}

interface SearchOptions {
  query: string;
  scope?: SearchScope;
  tagFilter?: string;
  sort?: "recent" | "name";
  limit?: number;
  includeBody?: boolean;
}

export function indexFragments(fragments: Fragment[]): SearchEntry[] {
  return fragments.map((fragment) => ({
    fragment,
    title: fragment.title.toLowerCase(),
    collection: fragment.collection.toLowerCase(),
    tags: fragment.tags.map((tag) => tag.toLowerCase()),
  }));
}

function matchesScope(item: Fragment, scope: SearchScope | undefined): boolean {
  switch (scope?.kind) {
    case "starred":
      return item.starred;
    case "recent":
      return Date.now() - item.modified <= 30 * 86400000;
    case "collection":
      return item.collection === scope.value || item.collection.startsWith(`${scope.value}/`);
    case "tag":
      return item.tags.includes(scope.value ?? "");
    case "all":
    case undefined:
      return true;
  }
  return true;
}

function fieldScore(text: string, term: string): number {
  if (text === term) return 120;
  if (text.startsWith(term)) return 100 - Math.min(text.length - term.length, 20) / 4;
  const contiguous = text.indexOf(term);
  if (contiguous >= 0)
    return (contiguous === 0 || /[\s_./-]/.test(text[contiguous - 1]) ? 84 : 72) - contiguous / 10;

  let position = 0;
  let first = -1;
  let gaps = 0;
  for (const character of term) {
    const found = text.indexOf(character, position);
    if (found < 0) return -1;
    if (first < 0) first = found;
    else gaps += found - position;
    position = found + 1;
  }
  return Math.max(1, 58 - first - gaps * 2 - (text.length - term.length) / 8);
}

function entryScore(entry: SearchEntry, terms: string[], includeBody: boolean): number {
  let total = 0;
  for (const term of terms) {
    const title = fieldScore(entry.title, term);
    let tag = -1;
    for (const value of entry.tags) tag = Math.max(tag, fieldScore(value, term));
    let best = Math.max(title >= 0 ? title + 8 : -1, tag);
    if (includeBody && best < 0) {
      if (entry.collection.includes(term)) best = 30;
      else if (entry.fragment.searchText.includes(term)) best = 15;
    }
    if (best < 0) return -1;
    total += best;
  }
  return total;
}

function compare(left: RankedFragment, right: RankedFragment, sort: "recent" | "name"): number {
  if (left.score !== right.score) return right.score - left.score;
  return sort === "name"
    ? left.fragment.title.localeCompare(right.fragment.title)
    : right.fragment.modified - left.fragment.modified;
}

export function searchFragments(index: SearchEntry[], options: SearchOptions): Fragment[] {
  const { query, scope, tagFilter, sort = "recent", limit, includeBody = false } = options;
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^#/, ""))
    .filter(Boolean);
  const results: RankedFragment[] = [];
  for (const entry of index) {
    if (!matchesScope(entry.fragment, scope)) continue;
    if (tagFilter && !entry.fragment.tags.includes(tagFilter)) continue;
    const score = entryScore(entry, terms, includeBody);
    if (score < 0) continue;
    const result = { fragment: entry.fragment, score };
    if (limit === undefined) {
      results.push(result);
      continue;
    }
    let position = 0;
    while (position < results.length && compare(results[position], result, sort) <= 0) position++;
    if (position < limit) results.splice(position, 0, result);
    if (results.length > limit) results.pop();
  }
  if (limit === undefined) results.sort((a, b) => compare(a, b, sort));
  return results.map((result) => result.fragment);
}
