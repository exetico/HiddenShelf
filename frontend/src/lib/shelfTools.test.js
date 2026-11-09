import { describe, expect, it } from "vitest";
import {
  extractUrls,
  findDuplicates,
  hasTracking,
  plainTitle,
  sameUrlKey,
  tidyReport,
  titleFromUrl,
} from "@/lib/shelfTools";

describe("shelfTools", () => {
  it("compares addresses the way people think of them", () => {
    const key = sameUrlKey("https://example.com/a");
    for (const same of [
      "http://example.com/a",
      "https://www.Example.com/a/",
      "https://example.com/a#top",
      "https://example.com/a?utm_source=mail&fbclid=1",
      "example.com/a",
    ])
      expect(sameUrlKey(same), same).toBe(key);
    expect(sameUrlKey("https://example.com/b")).not.toBe(key);
    expect(sameUrlKey("https://example.com/a?id=2")).not.toBe(key);
    expect(sameUrlKey("not a url")).toBeNull();
  });

  it("groups duplicates, oldest first, and leaves shared links out", () => {
    const groups = findDuplicates([
      { id: 3, url: "https://a.dk/x", created_at: "2026-03-01 00:00:00" },
      { id: 1, url: "http://a.dk/x/", created_at: "2026-01-01 00:00:00" },
      { id: 2, url: "https://b.dk" },
      { id: 4, url: "https://b.dk", is_from_shared_category: 1 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].links.map((l) => l.id)).toEqual([1, 3]);
  });

  it("spots tracking and titles that are only the address", () => {
    expect(hasTracking("https://a.dk/?utm_medium=x")).toBe(true);
    expect(hasTracking("https://a.dk/?q=x")).toBe(false);
    expect(plainTitle({ title: "https://www.a.dk/", url: "https://a.dk" })).toBe(true);
    expect(plainTitle({ title: "a.dk", url: "https://a.dk/page" })).toBe(true);
    expect(plainTitle({ title: "", url: "https://a.dk" })).toBe(true);
    expect(plainTitle({ title: "My bank", url: "https://a.dk" })).toBe(false);
  });

  it("reports what each tidy check finds, own links only", () => {
    const report = tidyReport([
      { id: 1, url: "https://a.dk", title: "A", category_id: null, tags: [] },
      { id: 2, url: "https://b.dk?gclid=1", title: "B", category_id: 4, tags: [{ name: "x" }] },
      { id: 3, url: "https://c.dk", title: "c.dk", category_id: null, tags: [], is_from_shared_category: 1 },
    ]);
    expect(report.uncategorized.map((l) => l.id)).toEqual([1]);
    expect(report.untagged.map((l) => l.id)).toEqual([1]);
    expect(report.tracking.map((l) => l.id)).toEqual([2]);
    expect(report["plain-title"]).toEqual([]);
  });

  it("picks web addresses out of pasted text", () => {
    const text = `Links for you:
      - https://example.com/one.
      - (example.org/two)
      - http://192.168.1.5:8080/admin
      - nas.lan:5000
      i.e. e.g. not-a-link hello.
      mail me@example.com or ftp://files.example.com
      https://example.com/one again`;
    expect(extractUrls(text)).toEqual([
      "https://example.com/one",
      "https://example.org/two",
      "http://192.168.1.5:8080/admin",
      "http://nas.lan:5000/",
    ]);
  });

  it("makes a readable title from an address", () => {
    expect(titleFromUrl("https://blog.example.com/2024/05/my-great_post.html")).toBe(
      "My great post · blog.example.com",
    );
    expect(titleFromUrl("https://www.example.com/")).toBe("example.com");
    expect(titleFromUrl("https://example.com/caf%C3%A9")).toBe("Café · example.com");
    expect(titleFromUrl(`https://example.com/${"a".repeat(300)}`)).toHaveLength(255);
  });
});
