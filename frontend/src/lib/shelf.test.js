import { describe, expect, it } from "vitest";
import { favoriteLinks, matchesSearch, selectLinks, sortLinks } from "@/lib/shelf";

const shelf = [
  { id: 1, title: "Grafana", url: "https://grafana.home", category_id: 1, created_at: "2026-01-01 10:00:00", total_visits: 3, tags: [{ id: 7, name: "infra" }] },
  { id: 2, title: "beta docs", description: "Read me", url: "https://docs.example", category_id: 2, created_at: "2026-02-01 10:00:00", total_visits: 9, display_order: 2, tags: [] },
  { id: 3, title: "Alpha", url: "https://alpha.example", category_id: null, created_at: "2026-03-01 10:00:00", total_visits: 0, display_order: 1, is_favorite: 1, tags: [{ id: 8, name: "home" }] },
  { id: 4, title: "Secret", url: "https://secret.example", category_id: 9, created_at: "2026-04-01 10:00:00", is_favorite: 1, tags: [{ id: 7, name: "infra" }] },
];
const hiddenIds = new Set([9]);
const ids = (result) => result.links.map((l) => l.id);

describe("matchesSearch", () => {
  it("finds the text in title, description, address or a tag name, ignoring case", () => {
    expect(matchesSearch(shelf[0], "GRAF")).toBe(true);
    expect(matchesSearch(shelf[1], "read")).toBe(true);
    expect(matchesSearch(shelf[1], "docs.example")).toBe(true);
    expect(matchesSearch(shelf[0], "infra")).toBe(true);
    expect(matchesSearch(shelf[0], "  ")).toBe(true);
    expect(matchesSearch(shelf[0], "nope")).toBe(false);
  });
});

describe("sortLinks", () => {
  it("puts your own positions first, then newest", () => {
    expect(sortLinks(shelf).map((l) => l.id)).toEqual([3, 2, 4, 1]);
  });
  it("sorts by date, title and visits", () => {
    expect(sortLinks(shelf, "newest").map((l) => l.id)).toEqual([4, 3, 2, 1]);
    expect(sortLinks(shelf, "oldest").map((l) => l.id)).toEqual([1, 2, 3, 4]);
    expect(sortLinks(shelf, "title").map((l) => l.title)).toEqual(["Alpha", "beta docs", "Grafana", "Secret"]);
    expect(sortLinks(shelf, "title_desc").map((l) => l.id)).toEqual([4, 1, 2, 3]);
    expect(sortLinks(shelf, "visits").map((l) => l.id)).toEqual([2, 1, 4, 3]);
  });
  it("leaves the list it was given alone", () => {
    const copy = [...shelf];
    sortLinks(shelf, "title");
    expect(shelf).toEqual(copy);
  });
});

describe("selectLinks", () => {
  it("leaves hidden categories out of the whole list", () => {
    const result = selectLinks(shelf, { hiddenIds });
    expect(ids(result).sort()).toEqual([1, 2, 3]);
    expect(result.hiddenMatches).toBe(0);
  });

  it("counts the search and tag matches it left out", () => {
    expect(selectLinks(shelf, { tag: "7", hiddenIds })).toMatchObject({ hiddenMatches: 1 });
    expect(ids(selectLinks(shelf, { tag: 7, hiddenIds }))).toEqual([1]);
    expect(selectLinks(shelf, { search: "secret", hiddenIds })).toMatchObject({ links: [], hiddenMatches: 1 });
  });

  it("shows them when asked, or when their category is picked", () => {
    expect(ids(selectLinks(shelf, { tag: "7", showHidden: true, hiddenIds })).sort()).toEqual([1, 4]);
    expect(ids(selectLinks(shelf, { category: "9", hiddenIds }))).toEqual([4]);
  });

  it("filters by category, Uncategorized, tag and search together", () => {
    expect(ids(selectLinks(shelf, { category: "2" }))).toEqual([2]);
    expect(ids(selectLinks(shelf, { category: "uncategorized" }))).toEqual([3]);
    expect(ids(selectLinks(shelf, { tag: "8", search: "alp" }))).toEqual([3]);
    expect(ids(selectLinks(shelf, { tag: "8", search: "graf" }))).toEqual([]);
  });
});

describe("favoriteLinks", () => {
  it("lists your own starred links outside hidden categories, by title", () => {
    const withShared = [...shelf, { id: 5, title: "Aaa", is_favorite: 1, is_from_shared_category: 1 }];
    expect(favoriteLinks(withShared, hiddenIds).map((l) => l.id)).toEqual([3]);
    expect(favoriteLinks(withShared).map((l) => l.id)).toEqual([3, 4]);
  });
});
