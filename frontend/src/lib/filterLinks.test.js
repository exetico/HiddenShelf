import { describe, expect, it } from "vitest";
import { filterHref, filterPath, filterQuery, isPlainClick } from "@/lib/filterLinks";

describe("filter links", () => {
  it("puts only the filters in use in the address", () => {
    expect(filterQuery({ category: 3, tag: "", q: "  " })).toEqual({ category: "3" });
    expect(filterPath("view", { tag: 7, q: " grafana " })).toBe("/view?tag=7&q=grafana");
    expect(filterPath("edit", {})).toBe("/edit");
    expect(filterPath("edit", { sort: "title" })).toBe("/edit?sort=title");
    expect(filterPath("view", { category: "uncategorized" })).toBe("/view?category=uncategorized");
  });

  it("includes the base path", () => {
    expect(filterHref("view", { tag: 7 }, "/shelf/")).toBe("/shelf/view?tag=7");
    expect(filterHref("view", { tag: 7 }, "/")).toBe("/view?tag=7");
  });

  it("leaves modified and middle clicks to the browser", () => {
    expect(isPlainClick({ button: 0 })).toBe(true);
    expect(isPlainClick({ button: 1 })).toBe(false);
    expect(isPlainClick({ button: 0, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ button: 0, metaKey: true })).toBe(false);
    expect(isPlainClick({ button: 0, shiftKey: true })).toBe(false);
  });
});
