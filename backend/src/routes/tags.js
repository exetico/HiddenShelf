/**
 * Tags routes — list, create, delete.
 *
 * Endpoint mapping:
 *   GET    /api/tags          → list (with usage_count)
 *   POST   /api/tags          → create
 *   DELETE /api/tags?id=      → delete
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import { sanitize, successResponse, errorResponse } from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";

const tags = new Hono();

// ─── GET /api/tags ───────────────────────────────────────────────

tags.get("/", requireAuth(), (c) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.*, COUNT(lt.link_id) as usage_count
     FROM tags t
     LEFT JOIN link_tags lt ON t.id = lt.tag_id
     WHERE t.user_id = ?
     GROUP BY t.id
     ORDER BY usage_count DESC, t.name ASC`,
    )
    .all(c.userId);

  return successResponse(c, { tags: rows });
});

// ─── POST /api/tags ──────────────────────────────────────────────

tags.post("/", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));
  const name = sanitize(input.name || "");

  if (!name) return errorResponse(c, "Tag name is required");

  const existing = db
    .prepare("SELECT * FROM tags WHERE name = ? AND user_id = ?")
    .get(name, c.userId);
  if (existing)
    return successResponse(c, { tag: existing }, "Tag already exists");

  const info = db
    .prepare("INSERT INTO tags (name, user_id) VALUES (?, ?)")
    .run(name, c.userId);
  const tag = db
    .prepare("SELECT * FROM tags WHERE id = ?")
    .get(info.lastInsertRowid);

  return successResponse(c, { tag }, "Tag created successfully");
});

// ─── DELETE /api/tags?id= ────────────────────────────────────────

tags.delete("/", requireAuth(), (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Tag ID is required");

  const tag = db
    .prepare("SELECT * FROM tags WHERE id = ? AND user_id = ?")
    .get(id, c.userId);
  if (!tag) return errorResponse(c, "Tag not found or access denied", 404);

  db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  return successResponse(c, {}, "Tag deleted successfully");
});

export default tags;
