import { describe, it, expect, vi } from "vitest";
import { applySaved, currentQuery, isActive, suggestName } from "./savedSearches";
import { selectLinks, toReadCount } from "./shelf";
import { filterQuery } from "./filterLinks";

describe("saved searches", () => {
  it("reads the filters that are on", () => {
    const store = { filterCategory: "3", filterTag: "", search: " soup ", sort: "newest", filterToRead: true };
    expect(currentQuery(store)).toEqual({ category: "3", q: "soup", sort: "newest", toread: "1" });
  });

  it("is active when the filters match; the sort only counts when saved", () => {
    const current = { tag: "4", q: "weeknight", sort: "title" };
    expect(isActive({ query: { tag: "4", q: "weeknight" } }, current)).toBe(true);
    expect(isActive({ query: { tag: "4", q: "weeknight", sort: "title" } }, current)).toBe(true);
    expect(isActive({ query: { tag: "4", q: "weeknight", sort: "newest" } }, current)).toBe(false);
    expect(isActive({ query: { tag: "4" } }, current)).toBe(false);
  });

  it("suggests a name from the filters", () => {
    const names = { categories: [{ id: 3, name: "Recipes" }], tags: [{ id: 4, name: "dinner" }] };
    expect(suggestName({ category: "3", tag: "4", q: "weeknight" }, names)).toBe("Recipes + #dinner + weeknight");
    expect(suggestName({ toread: "1" }, names)).toBe("To read");
    expect(suggestName({ sort: "title" }, names)).toBe("My search");
  });

  it("puts a saved search's filters on the store", () => {
    const store = {
      filterCategory: "9", search: "x", filterTag: "", sort: "", filterToRead: false,
      filterByTag: vi.fn(function (t) { this.filterTag = t; }),
      setSort: vi.fn(),
    };
    applySaved(store, { query: { tag: "4", toread: "1", sort: "oldest" } });
    expect(store.filterCategory).toBe("");
    expect(store.search).toBe("");
    expect(store.filterToRead).toBe(true);
    expect(store.filterByTag).toHaveBeenCalledWith("4");
    expect(store.setSort).toHaveBeenCalledWith("oldest");
  });
});

describe("To read filter", () => {
  const links = [
    { id: 1, title: "a", read_later: 1, category_id: null },
    { id: 2, title: "b", read_later: 0, category_id: null },
    { id: 3, title: "c", read_later: 1, category_id: 7 }, // hidden category
    { id: 4, title: "d", read_later: 1, is_from_shared_category: 1, category_id: 8 },
  ];

  it("shows only your own links saved to read later", () => {
    const { links: shown, hiddenMatches } = selectLinks(links, { toRead: true, hiddenIds: new Set([7]) });
    expect(shown.map((l) => l.id)).toEqual([1]);
    expect(hiddenMatches).toBe(1);
  });

  it("counts them outside hidden categories", () => {
    expect(toReadCount(links, new Set([7]))).toBe(1);
  });

  it("goes in the address as toread=1", () => {
    expect(filterQuery({ toread: true })).toEqual({ toread: "1" });
    expect(filterQuery({ toread: "1" })).toEqual({ toread: "1" });
    expect(filterQuery({ toread: "yes" })).toEqual({});
    expect(filterQuery({ toread: false })).toEqual({});
  });
});
