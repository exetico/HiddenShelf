/**
 * Tests for /api/user_settings endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Settings API", () => {
  let app, cookie, userId;

  beforeEach(() => {
    app = createTestApp();
    const auth = createAuthenticatedUser();
    cookie = auth.cookie;
    userId = auth.userId;
  });

  afterEach(() => {
    cleanup();
  });

  // ── GET /api/user_settings ──

  describe("GET /api/user_settings", () => {
    it("returns default settings for new user", async () => {
      const res = await app.request("/api/user_settings", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.settings).not.toHaveProperty("links_per_page");
      expect(data.settings.brand_color).toBe("#687061");
      expect(data.settings.floating_search).toBe(false);
    });

    it("fills in settings added after a user's settings were saved", async () => {
      getDb()
        .prepare("INSERT INTO user_settings (user_id, settings) VALUES (?, ?)")
        .run(userId, JSON.stringify({ brand_color: "#112233" }));
      const res = await app.request("/api/user_settings", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.settings).toEqual({ brand_color: "#112233", floating_search: false, saved_searches: [] });
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/user_settings");
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/user_settings ──

  describe("PUT /api/user_settings", () => {
    const put = (body) =>
      app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body),
      });

    it("turns the floating search bar on and off", async () => {
      let data = await json(await put({ floating_search: true }));
      expect(data.settings.floating_search).toBe(true);
      data = await json(await put({ brand_color: "#FF5733" }));
      expect(data.settings.floating_search).toBe(true);
      data = await json(await put({ floating_search: false }));
      expect(data.settings.floating_search).toBe(false);
    });

    it("refuses a floating_search value that isn't true or false", async () => {
      for (const value of ["true", 1, null]) {
        const res = await put({ floating_search: value });
        expect(res.status).toBe(400);
      }
      const data = await json(
        await app.request("/api/user_settings", { headers: { Cookie: cookie } }),
      );
      expect(data.settings.floating_search).toBe(false);
    });

    it("updates brand_color", async () => {
      const res = await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ brand_color: "#FF5733" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.settings.brand_color).toBe("#FF5733");
    });

    it("rejects invalid brand_color", async () => {
      const res = await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ brand_color: "not-a-color" }),
      });
      const data = await json(res);
      expect(data.error).toBeDefined();
    });

    it("drops the old links_per_page setting, saved or sent", async () => {
      // Saved before the setting went away
      getDb()
        .prepare("INSERT INTO user_settings (user_id, settings) VALUES (?, ?)")
        .run(userId, JSON.stringify({ links_per_page: 20, brand_color: "#123456" }));
      const read = await json(
        await app.request("/api/user_settings", { headers: { Cookie: cookie } }),
      );
      expect(read.settings).toEqual({ brand_color: "#123456", floating_search: false, saved_searches: [] });

      // An old client still sending it: ignored, not an error
      const res = await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ links_per_page: 50, brand_color: "#654321" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.settings).toEqual({ brand_color: "#654321", floating_search: false, saved_searches: [] });
    });
  });
});
