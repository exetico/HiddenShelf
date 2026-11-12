/**
 * Account routes — bulk operations on user data.
 *
 * Endpoint mapping:
 *   DELETE /api/account/data    → delete all user data (links, tags, categories)
 *   GET    /api/account/sessions → { other_sessions }: how many other devices are signed in
 *   DELETE /api/account/sessions → sign out every other device (this one stays)
 *   POST   /api/account/delete  {email} → delete the account itself, for good
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import { successResponse, errorResponse } from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";
import { sessions } from "../middleware/session.js";

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

// ─── Sessions: sign out everywhere else ──────────────────────────

account.get("/sessions", requireAuth(), (c) => {
  const all = sessions.countForUser(c.userId);
  return successResponse(c, { other_sessions: Math.max(0, all - 1) });
});

account.delete("/sessions", requireAuth(), (c) => {
  const removed = sessions.deleteForUser(c.userId, c.session.id());
  return successResponse(
    c,
    { signed_out: removed },
    removed === 1 ? "Signed out 1 other device" : `Signed out ${removed} other devices`,
  );
});

// ─── POST /api/account/delete — delete the account for good ──────
//
// The body must repeat the account's email, so a stray request can't do it.
// Everything that belongs to the account goes: links (and their visits and
// tags), categories (and who they were shared with), tags, settings, the
// shares it joined, unused login links and every session, this one too.
// The admins' update log keeps its rows, since it records who did what.

account.post("/delete", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));
  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(c.userId);
  if (!user) return errorResponse(c, "User not found", 404);

  const typed = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!typed || typed !== user.email.toLowerCase()) {
    return errorResponse(c, "Type your email address to delete your account.", 400);
  }

  db.transaction(() => {
    // Links in other people's categories don't exist (shared categories are
    // read-only), so the cascade from users covers links, categories, tags,
    // link_tags, link_visits, settings, shares and memberships.
    db.prepare("DELETE FROM magic_tokens WHERE email = ? COLLATE NOCASE").run(user.email);
    db.prepare("DELETE FROM access_list WHERE email = ? COLLATE NOCASE").run(user.email);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    sessions.deleteForUser(user.id);
  })();

  c.session.destroy();
  return successResponse(c, {}, "Your account is deleted");
});

export default account;
