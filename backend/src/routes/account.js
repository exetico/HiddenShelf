/**
 * Account routes — bulk operations on user data.
 *
 * Endpoint mapping:
 *   DELETE /api/account/data    → delete all user data (links, tags, categories)
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import { successResponse, errorResponse } from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";

const account = new Hono();

// ─── DELETE /api/account/data — delete all user data ─────────────

account.delete("/data", requireAuth(), (c) => {
  const db = getDb();

  const deleteAll = db.transaction(() => {
    // Delete link_tags for user's links
    db.prepare(
      "DELETE FROM link_tags WHERE link_id IN (SELECT id FROM links WHERE user_id = ?)",
    ).run(c.userId);

    // Delete link_visits for user's links
    db.prepare(
      "DELETE FROM link_visits WHERE link_id IN (SELECT id FROM links WHERE user_id = ?)",
    ).run(c.userId);

    // Delete links
    const linkResult = db
      .prepare("DELETE FROM links WHERE user_id = ?")
      .run(c.userId);

    // Delete tags
    const tagResult = db
      .prepare("DELETE FROM tags WHERE user_id = ?")
      .run(c.userId);

    // Remove user from shared categories
    db.prepare("DELETE FROM category_share_members WHERE user_id = ?").run(
      c.userId,
    );

    // Delete shares for user's categories
    db.prepare(
      "DELETE FROM category_share_members WHERE category_id IN (SELECT id FROM categories WHERE user_id = ?)",
    ).run(c.userId);
    db.prepare(
      "DELETE FROM category_shares WHERE category_id IN (SELECT id FROM categories WHERE user_id = ?)",
    ).run(c.userId);

    // Delete categories
    const categoryResult = db
      .prepare("DELETE FROM categories WHERE user_id = ?")
      .run(c.userId);

    return {
      links_deleted: linkResult.changes,
      tags_deleted: tagResult.changes,
      categories_deleted: categoryResult.changes,
    };
  });

  const result = deleteAll();

  return successResponse(
    c,
    { deleted: result },
    `Deleted ${result.links_deleted} links, ${result.tags_deleted} tags, ${result.categories_deleted} categories`,
  );
});

export default account;
