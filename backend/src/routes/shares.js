/**
 * Category shares routes — create/accept/leave/remove shares.
 *
 * Endpoint mapping:
 *   GET    /api/category_shares                        → list shared-with-me
 *   GET    /api/category_shares?category_id=           → share info for own category
 *   GET    /api/category_shares?code=                  → verify share code (public)
 *   POST   /api/category_shares  {category_id}         → create share code
 *   POST   /api/category_shares  {share_code}          → accept share
 *   DELETE /api/category_shares?category_id=&leave=1    → leave shared category
 *   DELETE /api/category_shares?category_id=&member_id= → remove member
 *   DELETE /api/category_shares?category_id=            → remove sharing
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import {
  generateShareCode,
  successResponse,
  errorResponse,
} from "../lib/helpers.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const shares = new Hono();

// ─── GET /api/category_shares ────────────────────────────────────

shares.get("/", optionalAuth(), (c) => {
  const db = getDb();
  const categoryId = c.req.query("category_id");
  const shareCode = c.req.query("code");

  // ── Verify share code (public) ──
  if (shareCode) {
    const share = db
      .prepare(
        `SELECT cs.*, c.name as category_name, c.icon, c.color, u.email as owner_email
       FROM category_shares cs
       JOIN categories c ON cs.category_id = c.id
       JOIN users u ON cs.created_by = u.id
       WHERE cs.share_code = ? AND (cs.expires_at IS NULL OR cs.expires_at > datetime('now'))`,
      )
      .get(shareCode);

    if (!share) return errorResponse(c, "Invalid or expired share code", 404);

    const linkCount = db
      .prepare("SELECT COUNT(*) as count FROM links WHERE category_id = ?")
      .get(share.category_id);

    return successResponse(c, {
      share: {
        category_name: share.category_name,
        icon: share.icon,
        color: share.color,
        owner_email: share.owner_email,
        link_count: linkCount.count,
        created_at: share.created_at,
      },
    });
  }

  // Everything else requires auth
  if (!c.userId) return errorResponse(c, "Authentication required", 401);

  // ── Share info for own category ──
  if (categoryId) {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
      .get(categoryId, c.userId);
    if (!category) return errorResponse(c, "Category not found", 404);

    const share = db
      .prepare("SELECT * FROM category_shares WHERE category_id = ?")
      .get(categoryId);

    const members = db
      .prepare(
        `SELECT csm.*, u.email
       FROM category_share_members csm
       JOIN users u ON csm.user_id = u.id
       WHERE csm.category_id = ?`,
      )
      .all(categoryId);

    return successResponse(c, { share: share || null, members });
  }

  // ── List shared-with-me ──
  const sharedCategories = db
    .prepare(
      `SELECT c.*, u.email as owner_email, csm.accepted_at
     FROM category_share_members csm
     JOIN categories c ON csm.category_id = c.id
     JOIN users u ON c.user_id = u.id
     WHERE csm.user_id = ?`,
    )
    .all(c.userId);

  for (const cat of sharedCategories) {
    const linkCount = db
      .prepare("SELECT COUNT(*) as count FROM links WHERE category_id = ?")
      .get(cat.id);
    cat.link_count = linkCount.count;
  }

  return successResponse(c, { shared_categories: sharedCategories });
});

// ─── POST /api/category_shares ───────────────────────────────────

shares.post("/", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));
  const categoryId = input.category_id || null;
  const shareCode = input.share_code || null;

  // ── Accept a share ──
  if (shareCode) {
    const share = db
      .prepare(
        `SELECT cs.*, c.user_id as owner_id
       FROM category_shares cs
       JOIN categories c ON cs.category_id = c.id
       WHERE cs.share_code = ? AND (cs.expires_at IS NULL OR cs.expires_at > datetime('now'))`,
      )
      .get(shareCode);

    if (!share) return errorResponse(c, "Invalid or expired share code", 404);
    if (share.owner_id === c.userId)
      return errorResponse(c, "You cannot accept your own share");

    const existing = db
      .prepare(
        "SELECT * FROM category_share_members WHERE category_id = ? AND user_id = ?",
      )
      .get(share.category_id, c.userId);
    if (existing)
      return errorResponse(c, "You have already accepted this share");

    db.prepare(
      "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
    ).run(share.category_id, c.userId);

    return successResponse(c, {}, "Successfully joined shared category");
  }

  // ── Create share code ──
  if (categoryId) {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
      .get(categoryId, c.userId);
    if (!category) return errorResponse(c, "Category not found", 404);

    const existing = db
      .prepare("SELECT * FROM category_shares WHERE category_id = ?")
      .get(categoryId);
    if (existing)
      return successResponse(
        c,
        { share: existing },
        "Share code already exists",
      );

    const code = generateShareCode();
    db.prepare(
      "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
    ).run(categoryId, code, c.userId);

    const share = db
      .prepare("SELECT * FROM category_shares WHERE category_id = ?")
      .get(categoryId);

    return successResponse(c, { share }, "Share code created");
  }

  return errorResponse(c, "Category ID or share code required");
});

// ─── DELETE /api/category_shares ─────────────────────────────────

shares.delete("/", requireAuth(), (c) => {
  const db = getDb();
  const categoryId = c.req.query("category_id");
  const memberId = c.req.query("member_id");
  const leave =
    c.req.query("leave") !== null && c.req.query("leave") !== undefined;

  if (!categoryId) return errorResponse(c, "Category ID required");

  // ── Leave a shared category ──
  if (leave) {
    db.prepare(
      "DELETE FROM category_share_members WHERE category_id = ? AND user_id = ?",
    ).run(categoryId, c.userId);
    return successResponse(c, {}, "Left shared category");
  }

  // Must own the category for removal operations
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
    .get(categoryId, c.userId);
  if (!category) return errorResponse(c, "Category not found", 404);

  // ── Remove specific member ──
  if (memberId) {
    db.prepare(
      "DELETE FROM category_share_members WHERE category_id = ? AND id = ?",
    ).run(categoryId, memberId);
    return successResponse(c, {}, "Member removed");
  }

  // ── Remove all sharing ──
  db.prepare("DELETE FROM category_share_members WHERE category_id = ?").run(
    categoryId,
  );
  db.prepare("DELETE FROM category_shares WHERE category_id = ?").run(
    categoryId,
  );
  return successResponse(c, {}, "Share removed");
});

export default shares;
