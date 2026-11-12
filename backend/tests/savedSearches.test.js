/**
 * Saved searches live in user settings and are checked strictly.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, createAuthenticatedUser, cleanup, json } from "./helpers.js";
import { checkSavedSearches } from "../src/routes/settings.js";

describe("Saved searches", () => {
  let app, cookie;
  beforeEach(() => {
    app = createTestApp();
    cookie = createAuthenticatedUser().cookie;
  });
  afterEach(() => cleanup());

  const put = (body) =>
    app.request("/api/user_settings", {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("starts empty and saves a list", async () => {
    const before = await json(await app.request("/api/user_settings", { headers: { Cookie: cookie } }));
    expect(before.settings.saved_searches).toEqual([]);

    const list = [{ name: " dinner + weeknight ", query: { tag: "4", q: "weeknight", sort: "newest" } }];
    const res = await put({ saved_searches: list });
    expect(res.status).toBe(200);
    const after = await json(await app.request("/api/user_settings", { headers: { Cookie: cookie } }));
    expect(after.settings.saved_searches).toEqual([
      { name: "dinner + weeknight", query: { tag: "4", q: "weeknight", sort: "newest" } },
    ]);
    // Other settings are kept
    expect(after.settings.brand_color).toBe("#687061");
  });

  it("refuses anything that isn't a filter", async () => {
    const bad = [
      "nope",
      [{ name: "", query: { q: "x" } }],
      [{ name: "x".repeat(61), query: { q: "x" } }],
      [{ name: "a", query: {} }],
      [{ name: "a", query: { tag: "abc" } }],
      [{ name: "a", query: { sort: "random" } }],
      [{ name: "a", query: { toread: "yes" } }],
      [{ name: "a", query: { evil: "1" } }],
      [{ name: "a", query: { q: 5 } }],
      [{ name: "a", query: { q: "x".repeat(201) } }],
      Array.from({ length: 31 }, (_, i) => ({ name: `s${i}`, query: { q: "x" } })),
    ];
    for (const saved_searches of bad) {
      const res = await put({ saved_searches });
      expect(res.status, JSON.stringify(saved_searches).slice(0, 80)).toBe(400);
    }
  });

  it("keeps the filters it knows and drops empty ones", () => {
    const { value } = checkSavedSearches([
      { name: "To read", query: { toread: "1", category: "uncategorized", q: " " } },
    ]);
    expect(value).toEqual([{ name: "To read", query: { toread: "1", category: "uncategorized" } }]);
  });
});
