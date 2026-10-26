/**
 * Tests for /api/category_shares endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Shares API", () => {
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

  function createCategory(name = "SharedCat") {
    const db = getDb();
    const info = db
      .prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)")
      .run(userId, name);
    return info.lastInsertRowid;
  }

  function currentCode(catId) {
    return getDb()
      .prepare("SELECT share_code FROM category_shares WHERE category_id = ?")
      .get(catId).share_code;
  }

  // ── POST /api/category_shares (create share code) ──

  describe("Create share code", () => {
    it("creates a share code for own category", async () => {
      const catId = createCategory();
      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ category_id: catId }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.share).toBeDefined();
      expect(data.share.share_code).toBeDefined();
    });

    it("returns existing share code for already-shared category", async () => {
      const catId = createCategory();
      await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ category_id: catId }),
      });
      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ category_id: catId }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.message).toContain("already exists");
    });

    it("rejects sharing non-owned category", async () => {
      const db = getDb();
      const otherUser = db
        .prepare("INSERT INTO users (email) VALUES (?)")
        .run("other@test.com");
      const catId = db
        .prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)")
        .run(otherUser.lastInsertRowid, "OtherCat").lastInsertRowid;

      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ category_id: catId }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/category_shares?code= (verify) ──

  describe("Verify share code", () => {
    it("verifies a valid share code (public)", async () => {
      const catId = createCategory("VerifyCat");
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "verifycode123", userId);

      const res = await app.request("/api/category_shares?code=verifycode123");
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.share.category_name).toBe("VerifyCat");
      expect(data.share.owner_email).toBeDefined();
    });

    it("returns 404 for invalid share code", async () => {
      const res = await app.request("/api/category_shares?code=invalidcode");
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/category_shares (accept share) ──

  describe("Accept share", () => {
    it("accepts a valid share code", async () => {
      const catId = createCategory();
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "acceptcode", userId);

      // Create another user to accept
      const other = createAuthenticatedUser("joiner@example.com");
      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: other.cookie },
        body: JSON.stringify({ share_code: "acceptcode" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.message).toContain("joined");
    });

    it("prevents accepting own share", async () => {
      const catId = createCategory();
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "owncode", userId);

      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ share_code: "owncode" }),
      });
      expect(res.status).toBe(400);
    });

    it("prevents double-accepting", async () => {
      const catId = createCategory();
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "doublecode", userId);

      const other = createAuthenticatedUser("double@example.com");
      await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: other.cookie },
        body: JSON.stringify({ share_code: "doublecode" }),
      });
      const fresh = currentCode(catId);
      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: other.cookie },
        body: JSON.stringify({ share_code: fresh }),
      });
      expect(res.status).toBe(400);
      // A refused join doesn't use the code up
      expect(currentCode(catId)).toBe(fresh);
    });

    it("uses the code up, so it can't be passed on", async () => {
      const catId = createCategory();
      getDb()
        .prepare(
          "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
        )
        .run(catId, "oncecode", userId);

      const first = createAuthenticatedUser("first@example.com");
      const ok = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: first.cookie },
        body: JSON.stringify({ share_code: "oncecode" }),
      });
      expect(ok.status).toBe(200);
      expect(currentCode(catId)).not.toBe("oncecode");

      const second = createAuthenticatedUser("second@example.com");
      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: second.cookie },
        body: JSON.stringify({ share_code: "oncecode" }),
      });
      expect(res.status).toBe(404);
      const verify = await app.request("/api/category_shares?code=oncecode");
      expect(verify.status).toBe(404);
      expect((await json(verify)).error).toContain("Ask the owner for a new one");
    });
  });

  describe("Reset share code", () => {
    it("makes a new code and keeps the members", async () => {
      const catId = createCategory();
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "oldcode", userId);
      const member = createAuthenticatedUser("member@example.com");
      db.prepare(
        "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
      ).run(catId, member.userId);

      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ category_id: catId, reset: true }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.share.share_code).not.toBe("oldcode");
      expect(currentCode(catId)).toBe(data.share.share_code);
      const verify = await app.request("/api/category_shares?code=oldcode");
      expect(verify.status).toBe(404);
      const members = db
        .prepare("SELECT COUNT(*) AS n FROM category_share_members WHERE category_id = ?")
        .get(catId).n;
      expect(members).toBe(1);
    });

    it("refuses to reset someone else's category", async () => {
      const catId = createCategory();
      getDb()
        .prepare(
          "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
        )
        .run(catId, "theircode", userId);
      const other = createAuthenticatedUser("intruder@example.com");
      const res = await app.request("/api/category_shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: other.cookie },
        body: JSON.stringify({ category_id: catId, reset: true }),
      });
      expect(res.status).toBe(404);
      expect(currentCode(catId)).toBe("theircode");
    });
  });

  // ── GET /api/category_shares (list shared-with-me) ──

  describe("List shared-with-me", () => {
    it("lists categories shared with user", async () => {
      const db = getDb();
      const otherUser = db
        .prepare("INSERT INTO users (email) VALUES (?)")
        .run("sharer@test.com");
      const catId = db
        .prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)")
        .run(otherUser.lastInsertRowid, "SharedWithMe").lastInsertRowid;
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "listcode", otherUser.lastInsertRowid);
      db.prepare(
        "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
      ).run(catId, userId);

      const res = await app.request("/api/category_shares", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.shared_categories).toHaveLength(1);
      expect(data.shared_categories[0].name).toBe("SharedWithMe");
    });
  });

  // ── GET /api/category_shares?category_id= (share info) ──

  describe("Get share info", () => {
    it("returns share info and members for own category", async () => {
      const catId = createCategory();
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "infocode", userId);

      const res = await app.request(
        `/api/category_shares?category_id=${catId}`,
        {
          headers: { Cookie: cookie },
        },
      );
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.share).toBeDefined();
      expect(data.members).toBeDefined();
    });
  });

  // ── DELETE /api/category_shares ──

  describe("DELETE shares", () => {
    it("leaves a shared category", async () => {
      const db = getDb();
      const otherUser = db
        .prepare("INSERT INTO users (email) VALUES (?)")
        .run("owner@test.com");
      const catId = db
        .prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)")
        .run(otherUser.lastInsertRowid, "LeaveCat").lastInsertRowid;
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "leavecode", otherUser.lastInsertRowid);
      db.prepare(
        "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
      ).run(catId, userId);

      const res = await app.request(
        `/api/category_shares?category_id=${catId}&leave=1`,
        {
          method: "DELETE",
          headers: { Cookie: cookie },
        },
      );
      const data = await json(res);
      expect(data.success).toBe(true);

      const member = db
        .prepare(
          "SELECT * FROM category_share_members WHERE category_id = ? AND user_id = ?",
        )
        .get(catId, userId);
      expect(member).toBeUndefined();
    });

    it("removes sharing entirely", async () => {
      const catId = createCategory();
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catId, "removecode", userId);

      const res = await app.request(
        `/api/category_shares?category_id=${catId}`,
        {
          method: "DELETE",
          headers: { Cookie: cookie },
        },
      );
      const data = await json(res);
      expect(data.success).toBe(true);

      const share = db
        .prepare("SELECT * FROM category_shares WHERE category_id = ?")
        .get(catId);
      expect(share).toBeUndefined();
    });
  });

  describe("List my own shares", () => {
    it("returns shared categories with their members", async () => {
      const shared = createCategory("Mine");
      createCategory("NotShared");
      const db = getDb();
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(shared, "ownedcode", userId);
      const other = createAuthenticatedUser("member@example.com");
      db.prepare(
        "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
      ).run(shared, other.userId);

      const res = await app.request("/api/category_shares?owned=1", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.owned_shares).toHaveLength(1);
      expect(data.owned_shares[0].name).toBe("Mine");
      expect(data.owned_shares[0].share_code).toBe("ownedcode");
      expect(data.owned_shares[0].members.map((m) => m.email)).toEqual([
        "member@example.com",
      ]);

      // Members don't see it as their own share
      const asMember = await app.request("/api/category_shares?owned=1", {
        headers: { Cookie: other.cookie },
      });
      expect((await json(asMember)).owned_shares).toHaveLength(0);
    });
  });
});
