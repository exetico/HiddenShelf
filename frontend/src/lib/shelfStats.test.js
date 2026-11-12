import { describe, it, expect } from "vitest";
import { addedPerMonth, mostOpened, neverOpened, ownLinks, shelfTotals, siteOf, topSites } from "./shelfStats";

const now = new Date("2026-11-12T12:00:00Z");

describe("shelf stats", () => {
  it("counts links added per month for the last 12 months", () => {
    const months = addedPerMonth(
      [
        { created_at: "2026-11-01 08:00:00" },
        { created_at: "2026-11-10 08:00:00" },
        { created_at: "2026-01-31 23:00:00" },
        { created_at: "2025-12-01 00:00:00" },
        { created_at: "2025-11-30 00:00:00" }, // 13 months back: left out
        { created_at: null },
      ],
      now,
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ key: "2025-12", label: "Dec", count: 1 });
    expect(months[1]).toMatchObject({ key: "2026-01", count: 1 });
    expect(months[11]).toMatchObject({ key: "2026-11", label: "Nov", year: 2026, count: 2 });
  });

  it("finds the sites you save most from", () => {
    expect(siteOf("https://www.example.com/a")).toBe("example.com");
    expect(siteOf("nope")).toBe("");
    const sites = topSites([
      { url: "https://b.com/1" },
      { url: "https://www.a.com/1" },
      { url: "https://a.com/2" },
      { url: "https://b.com/2" },
      { url: "https://c.com" },
    ], 2);
    expect(sites).toEqual([{ site: "a.com", count: 2 }, { site: "b.com", count: 2 }]);
  });

  it("lists links never opened, saved at least 30 days ago, oldest first", () => {
    const links = [
      { id: 1, created_at: "2026-10-20 00:00:00", open_count: 0 }, // too new
      { id: 2, created_at: "2026-01-01 00:00:00", open_count: 3 },
      { id: 3, created_at: "2026-05-01 00:00:00" },
      { id: 4, created_at: "2025-02-01 00:00:00", open_count: 0 },
    ];
    expect(neverOpened(links, now).map((l) => l.id)).toEqual([4, 3]);
  });

  it("ranks the links you open most", () => {
    const links = [
      { id: 1, open_count: 2, last_opened_at: "2026-11-01 00:00:00" },
      { id: 2, open_count: 5 },
      { id: 3, open_count: 2, last_opened_at: "2026-11-05 00:00:00" },
      { id: 4, open_count: 0 },
    ];
    expect(mostOpened(links).map((l) => l.id)).toEqual([2, 3, 1]);
  });

  it("adds up the headline numbers from your own links", () => {
    const links = ownLinks([
      { created_at: "2026-11-01 00:00:00", read_later: 1, is_public: 1, open_count: 1 },
      { created_at: "2026-01-01 00:00:00" },
      { created_at: "2026-11-01 00:00:00", is_from_shared_category: 1 },
    ]);
    expect(shelfTotals(links, now)).toEqual({ links: 2, addedLast30: 1, toRead: 1, public: 1, opened: 1 });
  });
});
