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

describe("Settings API", () => {
  let app, cookie;

  beforeEach(() => {
    app = createTestApp();
    const auth = createAuthenticatedUser();
    cookie = auth.cookie;
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
      expect(data.settings.links_per_page).toBe(100); // room for a whole shelf on one page
      expect(data.settings.brand_color).toBe("#687061");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/user_settings");
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/user_settings ──

  describe("PUT /api/user_settings", () => {
    it("updates links_per_page", async () => {
      const res = await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ links_per_page: 50 }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.settings.links_per_page).toBe(50);
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

    it("rejects invalid links_per_page", async () => {
      const res = await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ links_per_page: 999 }),
      });
      const data = await json(res);
      expect(data.error).toBeDefined();
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

    it("preserves existing settings when updating one field", async () => {
      // First set brand_color
      await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ brand_color: "#123456" }),
      });
      // Then update only links_per_page
      const res = await app.request("/api/user_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ links_per_page: 100 }),
      });
      const data = await json(res);
      expect(data.settings.brand_color).toBe("#123456");
      expect(data.settings.links_per_page).toBe(100);
    });
  });
});
