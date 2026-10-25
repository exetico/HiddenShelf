/**
 * Tests for /api/links endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Links API", () => {
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

  // ── Helper: create a link ──

  async function createLink(overrides = {}) {
    const payload = {
      url: "https://example.com",
      title: "Example",
      description: "A test link",
      ...overrides,
    };
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(payload),
    });
    return json(res);
  }

  // ── POST /api/links ──

  describe("POST /api/links", () => {
    it("creates a new link", async () => {
      const data = await createLink();
      expect(data.success).toBe(true);
      expect(data.link).toBeDefined();
      expect(data.link.url).toBe("https://example.com");
      expect(data.link.title).toBe("Example");
      expect(data.link.hash).toBeDefined();
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", title: "Test" }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects empty title", async () => {
      const res = await app.request("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: "https://example.com", title: "" }),
      });
      const data = await json(res);
      expect(data.error).toBeDefined();
    });

    it("rejects invalid URL", async () => {
      const res = await app.request("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: "not-a-url", title: "Test" }),
      });
      const data = await json(res);
      expect(data.error).toBeDefined();
    });

    it("creates link with tags", async () => {
      const data = await createLink({ tags: ["tag1", "tag2"] });
      expect(data.success).toBe(true);
      // Verify tags in DB
      const db = getDb();
      const tags = db
        .prepare(
          `SELECT t.name FROM tags t
         JOIN link_tags lt ON t.id = lt.tag_id
         WHERE lt.link_id = ?`,
        )
        .all(data.link.id);
      expect(tags).toHaveLength(2);
    });

    it("inherits direct_redirect from category", async () => {
      const db = getDb();
      const catInfo = db
        .prepare(
          "INSERT INTO categories (user_id, name, direct_redirect_default) VALUES (?, ?, ?)",
        )
        .run(userId, "TestCat", 1);
      const data = await createLink({ category_id: catInfo.lastInsertRowid });
      expect(data.link.direct_redirect).toBe(1);
    });
  });

  // ── GET /api/links (list) ──

  describe("GET /api/links", () => {
    it("lists links for authenticated user", async () => {
      await createLink({ title: "Link 1" });
      await createLink({ title: "Link 2", url: "https://example2.com" });

      const res = await app.request("/api/links", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.links).toHaveLength(2);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(2);
    });

    it("requires authentication for listing", async () => {
      const res = await app.request("/api/links");
      expect(res.status).toBe(401);
    });

    it("supports search", async () => {
      await createLink({ title: "Apple Link" });
      await createLink({ title: "Banana Link", url: "https://banana.com" });

      const res = await app.request("/api/links?search=Apple", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.links).toHaveLength(1);
      expect(data.links[0].title).toBe("Apple Link");
    });

    it("search matches tag names", async () => {
      await createLink({ title: "Tagged", tags: ["recipes"] });
      await createLink({ title: "Plain", url: "https://plain.com" });

      const res = await app.request("/api/links?search=recipe", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.links.map((l) => l.title)).toEqual(["Tagged"]);
    });

    it("supports tag filter", async () => {
      await createLink({ title: "Work one", tags: ["work"] });
      await createLink({ title: "Home", url: "https://home.com", tags: ["home"] });
      const tag = getDb()
        .prepare("SELECT id FROM tags WHERE name = 'work'")
        .get();

      const res = await app.request(`/api/links?tag_id=${tag.id}`, {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.links.map((l) => l.title)).toEqual(["Work one"]);
    });

    it("supports category filter", async () => {
      const db = getDb();
      const catInfo = db
        .prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)")
        .run(userId, "Cat1");
      await createLink({
        title: "Categorized",
        category_id: catInfo.lastInsertRowid,
      });
      await createLink({ title: "Uncategorized", url: "https://other.com" });

      const res = await app.request(
        `/api/links?category_id=${catInfo.lastInsertRowid}`,
        {
          headers: { Cookie: cookie },
        },
      );
      const data = await json(res);
      expect(data.links).toHaveLength(1);
      expect(data.links[0].title).toBe("Categorized");
    });

    it("includes total_visits count for each link", async () => {
      const db = getDb();
      const created = await createLink({
        title: "Visited Link",
        url: "https://visited.com",
        is_public: 1,
      });
      const linkId = created.link.id;

      // Insert some visit records
      db.prepare(
        "INSERT INTO link_visits (link_id, ip_masked) VALUES (?, ?)",
      ).run(linkId, "1.2.3.0");
      db.prepare(
        "INSERT INTO link_visits (link_id, ip_masked) VALUES (?, ?)",
      ).run(linkId, "1.2.4.0");

      const res = await app.request("/api/links", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      const visitedLink = data.links.find((l) => l.id === linkId);
      expect(visitedLink).toBeDefined();
      expect(visitedLink.total_visits).toBe(2);
    });

    it("returns total_visits of 0 for links with no visits", async () => {
      await createLink({ title: "No Visits" });
      const res = await app.request("/api/links", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.links[0].total_visits).toBe(0);
    });

    it("supports pagination", async () => {
      for (let i = 1; i <= 25; i++) {
        await createLink({
          title: `Link ${i}`,
          url: `https://example${i}.com`,
        });
      }

      const res = await app.request("/api/links?page=1&limit=20", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.links).toHaveLength(20);
      expect(data.pagination.total).toBe(25);
      expect(data.pagination.pages).toBe(2);
    });
  });

  // ── GET /api/links?id= (single) ──

  describe("GET /api/links?id=", () => {
    it("returns a single link by id", async () => {
      const created = await createLink();
      const res = await app.request(`/api/links?id=${created.link.id}`, {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.link.id).toBe(created.link.id);
      expect(data.link.tags).toBeDefined();
    });

    it("returns 404 for non-existent link", async () => {
      const res = await app.request("/api/links?id=9999", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/links?hash= (public) ──

  describe("GET /api/links?hash=", () => {
    it("returns a public link by hash without auth", async () => {
      const created = await createLink({ is_public: 1 });
      // Need to get the hash from the DB since createLink doesn't return tags
      const db = getDb();
      const link = db
        .prepare("SELECT hash FROM links WHERE id = ?")
        .get(created.link.id);

      const res = await app.request(`/api/links?hash=${link.hash}`);
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.link).toBeDefined();
    });

    it("returns 404 for private link by hash", async () => {
      const created = await createLink({ is_public: 0 });
      const db = getDb();
      const link = db
        .prepare("SELECT hash FROM links WHERE id = ?")
        .get(created.link.id);

      const res = await app.request(`/api/links?hash=${link.hash}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/links?id= ──

  describe("PUT /api/links?id=", () => {
    it("updates a link", async () => {
      const created = await createLink();
      const res = await app.request(`/api/links?id=${created.link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ title: "Updated Title" }),
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.link.title).toBe("Updated Title");
    });

    it("updates tags", async () => {
      const created = await createLink({ tags: ["old-tag"] });
      await app.request(`/api/links?id=${created.link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ tags: ["new-tag-1", "new-tag-2"] }),
      });
      const db = getDb();
      const tags = db
        .prepare(
          "SELECT t.name FROM tags t JOIN link_tags lt ON t.id = lt.tag_id WHERE lt.link_id = ?",
        )
        .all(created.link.id);
      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.name)).toContain("new-tag-1");
    });

    it("returns 404 for non-existent link", async () => {
      const res = await app.request("/api/links?id=9999", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/links?id= ──

  describe("DELETE /api/links?id=", () => {
    it("deletes a link", async () => {
      const created = await createLink();
      const res = await app.request(`/api/links?id=${created.link.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);

      // Verify deleted
      const db = getDb();
      const link = db
        .prepare("SELECT * FROM links WHERE id = ?")
        .get(created.link.id);
      expect(link).toBeUndefined();
    });

    it("returns 404 for already-deleted link", async () => {
      const res = await app.request("/api/links?id=9999", {
        method: "DELETE",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Shared links ──

  describe("Shared category links", () => {
    it("includes links from shared categories", async () => {
      const db = getDb();
      // Create another user with a shared category
      const otherInfo = db
        .prepare("INSERT INTO users (email) VALUES (?)")
        .run("other@example.com");
      const catInfo = db
        .prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)")
        .run(otherInfo.lastInsertRowid, "SharedCat");
      db.prepare(
        "INSERT INTO links (user_id, hash, url, title, category_id) VALUES (?, ?, ?, ?, ?)",
      ).run(
        otherInfo.lastInsertRowid,
        "sharedlink1",
        "https://shared.com",
        "Shared Link",
        catInfo.lastInsertRowid,
      );
      // Share category with our user
      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
      ).run(catInfo.lastInsertRowid, "testcode123", otherInfo.lastInsertRowid);
      db.prepare(
        "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
      ).run(catInfo.lastInsertRowid, userId);

      const res = await app.request("/api/links?include_shared=1", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      const sharedLink = data.links.find((l) => l.title === "Shared Link");
      expect(sharedLink).toBeDefined();
      expect(sharedLink.is_from_shared_category).toBe(1);
    });
  });
});
