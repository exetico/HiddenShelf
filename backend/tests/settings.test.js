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
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/user_settings");
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/user_settings ──

  describe("PUT /api/user_settings", () => {
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
      expect(read.settings).toEqual({ brand_color: "#123456" });

      // An old client still sending it: ignored, not an error
      const res = await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ links_per_page: 50, brand_color: "#654321" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.settings).toEqual({ brand_color: "#654321" });
    });
  });
});
