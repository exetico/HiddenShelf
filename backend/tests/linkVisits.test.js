/**
 * Tests for /api/link_visits endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Link Visits API", () => {
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

  function createPublicLink(hash = "testhash1") {
    const db = getDb();
    db.prepare(
      "INSERT INTO links (user_id, hash, url, title, is_public) VALUES (?, ?, ?, ?, 1)",
    ).run(userId, hash, "https://example.com", "Public Link");
    return db.prepare("SELECT * FROM links WHERE hash = ?").get(hash);
  }

  // ── POST /api/link_visits ──

  describe("POST /api/link_visits", () => {
    it("logs a visit for a public link (no auth required)", async () => {
      createPublicLink("visithash1");
      const res = await app.request("/api/link_visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: "visithash1" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);

      const db = getDb();
      const visits = db
        .prepare(
          "SELECT * FROM link_visits WHERE link_id = (SELECT id FROM links WHERE hash = ?)",
        )
        .all("visithash1");
      expect(visits).toHaveLength(1);
    });

    it("rejects visit for non-existent link", async () => {
      const res = await app.request("/api/link_visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: "doesnotexist" }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects visit for private link", async () => {
      const db = getDb();
      db.prepare(
        "INSERT INTO links (user_id, hash, url, title, is_public) VALUES (?, ?, ?, ?, 0)",
      ).run(userId, "privatehash", "https://private.com", "Private");
      const res = await app.request("/api/link_visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: "privatehash" }),
      });
      expect(res.status).toBe(404);
    });

    it("requires hash parameter", async () => {
      const res = await app.request("/api/link_visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/link_visits?link_id= ──

  describe("GET /api/link_visits?link_id=", () => {
    it("returns stats for own link", async () => {
      const link = createPublicLink("statshash1");
      const db = getDb();
      db.prepare(
        "INSERT INTO link_visits (link_id, ip_masked, browser, os) VALUES (?, ?, ?, ?)",
      ).run(link.id, "1.2.3.xxx", "Chrome", "Windows");
      db.prepare(
        "INSERT INTO link_visits (link_id, ip_masked, browser, os) VALUES (?, ?, ?, ?)",
      ).run(link.id, "4.5.6.xxx", "Firefox", "macOS");

      const res = await app.request(`/api/link_visits?link_id=${link.id}`, {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.visits).toHaveLength(2);
      expect(data.stats.total_visits).toBe(2);
      expect(data.stats.unique_visitors).toBe(2);
      expect(data.stats.browsers).toBeDefined();
      expect(data.stats.operating_systems).toBeDefined();
      expect(data.stats.daily_visits).toBeDefined();
    });

    it("returns 404 for non-owned link", async () => {
      const db = getDb();
      const otherUser = db
        .prepare("INSERT INTO users (email) VALUES (?)")
        .run("other@example.com");
      db.prepare(
        "INSERT INTO links (user_id, hash, url, title, is_public) VALUES (?, ?, ?, ?, 1)",
      ).run(
        otherUser.lastInsertRowid,
        "otherhash",
        "https://other.com",
        "Other",
      );
      const link = db
        .prepare("SELECT id FROM links WHERE hash = 'otherhash'")
        .get();

      const res = await app.request(`/api/link_visits?link_id=${link.id}`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/link_visits (summary) ──

  describe("GET /api/link_visits (summary)", () => {
    it("returns summary for all public links", async () => {
      createPublicLink("summary1");
      createPublicLink("summary2");

      const res = await app.request("/api/link_visits", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
      expect(data.summary).toHaveLength(2);
      expect(data.total_visits).toBeDefined();
      expect(data.days).toBeDefined();
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/link_visits");
      expect(res.status).toBe(401);
    });
  });
});
