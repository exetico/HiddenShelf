/**
 * Categories routes — CRUD for categories.
 *
 * Endpoint mapping:
 *   GET    /api/categories          → list (with link_count, is_shared, member_count)
 *   POST   /api/categories          → create
 *   PUT    /api/categories?id=      → update (incl. is_favorite)
 *   PUT    /api/categories/order    → reorder {ids: [...]}
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
     LEFT JOIN links l ON c.id = l.category_id AND l.deleted_at IS NULL
     WHERE c.user_id = ?
     GROUP BY c.id
     ORDER BY c.position ASC, c.created_at DESC, c.id ASC`,
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

  // New categories go to the top, matching the old newest-first order
  const { top } = db
    .prepare(
      "SELECT COALESCE(MIN(position), 0) - 1 as top FROM categories WHERE user_id = ?",
    )
    .get(c.userId);

  const info = db
    .prepare(
      "INSERT INTO categories (user_id, name, icon, color, direct_redirect_default, position, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    )
    .run(c.userId, name, icon, color, directRedirectDefault, top);

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
  const isFavorite =
    input.is_favorite !== undefined
      ? input.is_favorite
        ? 1
        : 0
      : existing.is_favorite || 0;
  const isHidden =
    input.is_hidden !== undefined
      ? input.is_hidden
        ? 1
        : 0
      : existing.is_hidden || 0;

  if (!name) return errorResponse(c, "Category name is required");
  if (name.length > MAX_LENGTHS.categoryName)
    return errorResponse(
      c,
      `Category name must not exceed ${MAX_LENGTHS.categoryName} characters`,
    );

  db.prepare(
    "UPDATE categories SET name = ?, icon = ?, color = ?, direct_redirect_default = ?, is_favorite = ?, is_hidden = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(name, icon, color, directRedirectDefault, isFavorite, isHidden, id);

  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  return successResponse(c, { category }, "Category updated successfully");
});

// ─── PUT /api/categories/order ──────────────────────────────────

categories.put("/order", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(input.ids) ? input.ids.map(Number) : null;
  if (!ids || ids.some((id) => !Number.isInteger(id)))
    return errorResponse(c, "ids must be an array of category IDs");

  const owned = new Set(
    db
      .prepare("SELECT id FROM categories WHERE user_id = ?")
      .all(c.userId)
      .map((r) => r.id),
  );
  if (ids.length !== owned.size || !ids.every((id) => owned.has(id)))
    return errorResponse(c, "ids must list each of your categories once");

  const update = db.prepare(
    "UPDATE categories SET position = ? WHERE id = ? AND user_id = ?",
  );
  db.transaction(() => {
    ids.forEach((id, index) => update.run(index, id, c.userId));
  })();

  return successResponse(c, {}, "Category order saved");
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

  // Nullify category_id on orphaned links before deleting
  db.prepare("UPDATE links SET category_id = NULL WHERE category_id = ?").run(
    id,
  );
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  return successResponse(c, {}, "Category deleted successfully");
});

export default categories;
