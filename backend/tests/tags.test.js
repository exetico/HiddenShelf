/**
 * Tests for /api/tags endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Tags API", () => {
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

  // ── GET /api/tags ──

  describe("GET /api/tags", () => {
    it("lists tags with usage count", async () => {
      const db = getDb();
      // Create tags
      db.prepare("INSERT INTO tags (name, user_id) VALUES (?, ?)").run(
        "tag1",
        userId,
      );
      db.prepare("INSERT INTO tags (name, user_id) VALUES (?, ?)").run(
        "tag2",
        userId,
      );

      const res = await app.request("/api/tags", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.tags).toHaveLength(2);
      expect(data.tags[0].usage_count).toBeDefined();
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/tags");
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/tags ──

  describe("POST /api/tags", () => {
    it("creates a new tag", async () => {
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "newtag" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.tag.name).toBe("newtag");
    });

    it("returns existing tag for duplicate name", async () => {
      await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "duplicate" }),
      });
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "duplicate" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.message).toContain("already exists");
    });

    it("rejects empty name", async () => {
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "" }),
      });
      const data = await json(res);
      expect(data.error).toBeDefined();
    });
  });

  // ── DELETE /api/tags?id= ──

  describe("DELETE /api/tags?id=", () => {
    it("deletes a tag", async () => {
      const db = getDb();
      const info = db
        .prepare("INSERT INTO tags (name, user_id) VALUES (?, ?)")
        .run("todelete", userId);

      const res = await app.request(`/api/tags?id=${info.lastInsertRowid}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);

      const tag = db
        .prepare("SELECT * FROM tags WHERE id = ?")
        .get(info.lastInsertRowid);
      expect(tag).toBeUndefined();
    });

    it("returns 404 for non-existent tag", async () => {
      const res = await app.request("/api/tags?id=9999", {
        method: "DELETE",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });

    it("prevents deleting another user's tag", async () => {
      const db = getDb();
      const otherUser = db
        .prepare("INSERT INTO users (email) VALUES (?)")
        .run("other@example.com");
      const info = db
        .prepare("INSERT INTO tags (name, user_id) VALUES (?, ?)")
        .run("othertag", otherUser.lastInsertRowid);

      const res = await app.request(`/api/tags?id=${info.lastInsertRowid}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });
  });
});
