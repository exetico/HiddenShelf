/**
 * Categories routes — CRUD for categories.
 *
 * Endpoint mapping:
 *   GET    /api/categories          → list (with link_count, is_shared, member_count)
 *   POST   /api/categories          → create
 *   PUT    /api/categories?id=      → update
 *   DELETE /api/categories?id=      → delete
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import {
  sanitize,
  successResponse,
  errorResponse,
  MAX_LENGTHS,
} from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";

const categories = new Hono();

// ─── GET /api/categories ─────────────────────────────────────────

categories.get("/", requireAuth(), (c) => {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT c.*, COUNT(l.id) as link_count,
            (SELECT COUNT(*) FROM category_shares cs WHERE cs.category_id = c.id) as is_shared,
            (SELECT COUNT(*) FROM category_share_members csm WHERE csm.category_id = c.id) as member_count
     FROM categories c
     LEFT JOIN links l ON c.id = l.category_id
     WHERE c.user_id = ?
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    )
    .all(c.userId);

  return successResponse(c, { categories: rows });
});

// ─── POST /api/categories ────────────────────────────────────────

categories.post("/", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));

  const name = sanitize(input.name || "");
  const icon = sanitize(input.icon || "");
  const color = sanitize(input.color || "");
  const directRedirectDefault = input.direct_redirect_default ? 1 : 0;

  if (!name) return errorResponse(c, "Category name is required");
  if (name.length > MAX_LENGTHS.categoryName)
    return errorResponse(
      c,
      `Category name must not exceed ${MAX_LENGTHS.categoryName} characters`,
    );

  // Check duplicate
  const existing = db
    .prepare("SELECT * FROM categories WHERE user_id = ? AND name = ?")
    .get(c.userId, name);

  if (existing) {
    return successResponse(
      c,
      { category: existing },
      "Category already exists",
    );
  }

  const info = db
    .prepare(
      "INSERT INTO categories (user_id, name, icon, color, direct_redirect_default) VALUES (?, ?, ?, ?, ?)",
    )
    .run(c.userId, name, icon, color, directRedirectDefault);

  const category = db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(info.lastInsertRowid);
  return successResponse(c, { category }, "Category created successfully");
});

// ─── PUT /api/categories?id= ────────────────────────────────────

categories.put("/", requireAuth(), async (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Category ID is required");

  const existing = db
    .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
    .get(id, c.userId);
  if (!existing) return errorResponse(c, "Category not found", 404);

  const input = await c.req.json().catch(() => ({}));
  const name = sanitize(input.name ?? existing.name);
  const icon = sanitize(input.icon ?? existing.icon);
  const color = sanitize(input.color ?? existing.color);
  const directRedirectDefault =
    input.direct_redirect_default !== undefined
      ? input.direct_redirect_default
        ? 1
        : 0
      : existing.direct_redirect_default || 0;

  if (!name) return errorResponse(c, "Category name is required");
  if (name.length > MAX_LENGTHS.categoryName)
    return errorResponse(
      c,
      `Category name must not exceed ${MAX_LENGTHS.categoryName} characters`,
    );

  db.prepare(
    "UPDATE categories SET name = ?, icon = ?, color = ?, direct_redirect_default = ? WHERE id = ?",
  ).run(name, icon, color, directRedirectDefault, id);

  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  return successResponse(c, { category }, "Category updated successfully");
});

// ─── DELETE /api/categories?id= ──────────────────────────────────

categories.delete("/", requireAuth(), (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Category ID is required");

  const existing = db
    .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
    .get(id, c.userId);
  if (!existing) return errorResponse(c, "Category not found", 404);

  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  return successResponse(c, {}, "Category deleted successfully");
});

export default categories;
