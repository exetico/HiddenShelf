/**
 * Tests for /api/categories endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Categories API", () => {
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

  async function createCategory(name = "Test Category", overrides = {}) {
    const res = await app.request("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name, ...overrides }),
    });
    return json(res);
  }

  // ── GET /api/categories ──

  describe("GET /api/categories", () => {
    it("lists categories for authenticated user", async () => {
      await createCategory("Cat 1");
      await createCategory("Cat 2");

      const res = await app.request("/api/categories", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.categories).toHaveLength(2);
    });

    it("includes link_count, is_shared, and member_count", async () => {
      const catData = await createCategory("CountTest");
      const db = getDb();
      // Add a link to this category
      db.prepare(
        "INSERT INTO links (user_id, hash, url, title, category_id) VALUES (?, ?, ?, ?, ?)",
      ).run(
        userId,
        "countlink1",
        "https://example.com",
        "test",
        catData.category.id,
      );

      const res = await app.request("/api/categories", {
        headers: { Cookie: cookie },
      });
      const data = await json(res);
      const cat = data.categories.find((c) => c.name === "CountTest");
      expect(cat.link_count).toBe(1);
      expect(cat.is_shared).toBeDefined();
      expect(cat.member_count).toBeDefined();
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/categories");
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/categories ──

  describe("POST /api/categories", () => {
    it("creates a category", async () => {
      const data = await createCategory("New Category", {
        icon: "mdi-folder",
        color: "#ff0000",
      });
      expect(data.success).toBe(true);
      expect(data.category.name).toBe("New Category");
      expect(data.category.icon).toBe("mdi-folder");
      expect(data.category.color).toBe("#ff0000");
    });

    it("returns existing category for duplicate name", async () => {
      const first = await createCategory("Unique");
      const second = await createCategory("Unique");
      expect(second.success).toBe(true);
      expect(second.category.id).toBe(first.category.id);
    });

    it("rejects empty name", async () => {
      const res = await app.request("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "" }),
      });
      const data = await json(res);
      expect(data.error).toBeDefined();
    });
  });

  // ── PUT /api/categories?id= ──

  describe("PUT /api/categories?id=", () => {
    it("updates a category", async () => {
      const created = await createCategory("Original");
      const res = await app.request(
        `/api/categories?id=${created.category.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ name: "Updated" }),
        },
      );
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.category.name).toBe("Updated");
    });

    it("returns 404 for non-existent category", async () => {
      const res = await app.request("/api/categories?id=9999", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Updated" }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/categories?id= ──

  describe("DELETE /api/categories?id=", () => {
    it("deletes a category", async () => {
      const created = await createCategory("ToDelete");
      const res = await app.request(
        `/api/categories?id=${created.category.id}`,
        {
          method: "DELETE",
          headers: { Cookie: cookie },
        },
      );
      const data = await json(res);
      expect(data.success).toBe(true);

      const db = getDb();
      const cat = db
        .prepare("SELECT * FROM categories WHERE id = ?")
        .get(created.category.id);
      expect(cat).toBeUndefined();
    });

    it("returns 404 for non-existent category", async () => {
      const res = await app.request("/api/categories?id=9999", {
        method: "DELETE",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("Order and favorites", () => {
    async function list() {
      const res = await app.request("/api/categories", {
        headers: { Cookie: cookie },
      });
      return (await json(res)).categories;
    }

    function putOrder(ids, as = cookie) {
      return app.request("/api/categories/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: as },
        body: JSON.stringify({ ids }),
      });
    }

    it("lists new categories first by default", async () => {
      await createCategory("First");
      await createCategory("Second");
      expect((await list()).map((c) => c.name)).toEqual(["Second", "First"]);
    });

    it("saves a custom order", async () => {
      const a = (await createCategory("A")).category.id;
      const b = (await createCategory("B")).category.id;
      const c2 = (await createCategory("C")).category.id;
      const res = await putOrder([a, c2, b]);
      expect((await json(res)).success).toBe(true);
      expect((await list()).map((c) => c.name)).toEqual(["A", "C", "B"]);
    });

    it("rejects an order that does not list exactly your categories", async () => {
      const a = (await createCategory("A")).category.id;
      await createCategory("B");
      expect((await putOrder([a])).status).toBe(400);

      const other = createAuthenticatedUser("other@example.com");
      expect((await putOrder([a], other.cookie)).status).toBe(400);
    });

    it("toggles is_favorite via update", async () => {
      const id = (await createCategory("Fav")).category.id;
      const res = await app.request(`/api/categories?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ is_favorite: true }),
      });
      const data = await json(res);
      expect(data.category.is_favorite).toBe(1);
      expect(data.category.name).toBe("Fav");
    });
  });
});
