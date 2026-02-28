/**
 * Links routes — CRUD for links with tags, pagination, search.
 *
 * Endpoint mapping:
 *   GET    /api/links                → list (paginated, searchable)
 *   GET    /api/links?id=            → single link (auth)
 *   GET    /api/links?hash=          → public link by hash
 *   POST   /api/links                → create
 *   PUT    /api/links?id=            → update
 *   DELETE /api/links?id=            → delete
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import {
  sanitize,
  isValidUrl,
  generateHash,
  successResponse,
  errorResponse,
  MAX_LENGTHS,
} from "../lib/helpers.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import config from "../config.js";

const links = new Hono();

// Helper: get tags for a link
function getTagsForLink(db, linkId) {
  return db
    .prepare(
      `SELECT t.* FROM tags t
     JOIN link_tags lt ON t.id = lt.tag_id
     WHERE lt.link_id = ?`,
    )
    .all(linkId);
}

// Helper: sync tags for a link
function syncTags(db, linkId, tagNames, userId) {
  // Remove old tags
  db.prepare("DELETE FROM link_tags WHERE link_id = ?").run(linkId);

  for (const raw of tagNames) {
    const name = sanitize(raw);
    if (!name) continue;

    let tag = db
      .prepare("SELECT id FROM tags WHERE name = ? AND user_id = ?")
      .get(name, userId);
    if (!tag) {
      const info = db
        .prepare("INSERT INTO tags (name, user_id) VALUES (?, ?)")
        .run(name, userId);
      tag = { id: info.lastInsertRowid };
    }
    db.prepare(
      "INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)",
    ).run(linkId, tag.id);
  }
}

// ─── GET /api/links ──────────────────────────────────────────────

links.get("/", optionalAuth(), (c) => {
  const db = getDb();
  const id = c.req.query("id");
  const hash = c.req.query("hash");

  // ── By hash (public) ──
  if (hash) {
    const link = db
      .prepare(
        `SELECT l.*, u.email as owner_email
       FROM links l
       JOIN users u ON l.user_id = u.id
       WHERE l.hash = ? AND l.is_public = 1`,
      )
      .get(hash);

    if (!link) return errorResponse(c, "Link not found or is private", 404);
    link.tags = getTagsForLink(db, link.id);
    return successResponse(c, { link });
  }

  // Everything below requires auth
  if (!c.userId) return errorResponse(c, "Authentication required", 401);

  // ── Single by id ──
  if (id) {
    const link = db
      .prepare(
        `SELECT l.*, c.name as category_name
       FROM links l
       LEFT JOIN categories c ON l.category_id = c.id
       WHERE l.id = ? AND l.user_id = ?`,
      )
      .get(id, c.userId);

    if (!link) return errorResponse(c, "Link not found", 404);
    link.tags = getTagsForLink(db, link.id);
    return successResponse(c, { link });
  }

  // ── List (paginated) ──
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const validLimits = [20, 50, 100, 250, 500];
  let limit = parseInt(c.req.query("limit") || String(config.linksPerPage), 10);
  if (!validLimits.includes(limit)) limit = config.linksPerPage;
  const offset = (page - 1) * limit;

  const categoryId = c.req.query("category_id") || null;
  const search = c.req.query("search") || null;
  const includeShared = c.req.query("include_shared") !== "0";

  const where = [];
  const params = [];

  if (includeShared) {
    const sharedRows = db
      .prepare(
        "SELECT category_id FROM category_share_members WHERE user_id = ?",
      )
      .all(c.userId);
    const sharedIds = sharedRows.map((r) => r.category_id);

    if (sharedIds.length > 0) {
      const placeholders = sharedIds.map(() => "?").join(",");
      where.push(`(l.user_id = ? OR l.category_id IN (${placeholders}))`);
      params.push(c.userId, ...sharedIds);
    } else {
      where.push("l.user_id = ?");
      params.push(c.userId);
    }
  } else {
    where.push("l.user_id = ?");
    params.push(c.userId);
  }

  if (categoryId) {
    where.push("l.category_id = ?");
    params.push(categoryId);
  }

  if (search) {
    where.push("(l.title LIKE ? OR l.description LIKE ? OR l.url LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const whereClause = where.join(" AND ");

  const total = db
    .prepare(`SELECT COUNT(*) as total FROM links l WHERE ${whereClause}`)
    .get(...params).total;

  const linksRows = db
    .prepare(
      `SELECT l.*, c.name as category_name,
            CASE WHEN l.user_id != ? THEN 1 ELSE 0 END as is_from_shared_category
     FROM links l
     LEFT JOIN categories c ON l.category_id = c.id
     WHERE ${whereClause}
     ORDER BY
       CASE WHEN l.display_order IS NULL THEN 1 ELSE 0 END,
       l.display_order ASC,
       l.created_at DESC
     LIMIT ? OFFSET ?`,
    )
    .all(c.userId, ...params, limit, offset);

  for (const link of linksRows) {
    link.tags = getTagsForLink(db, link.id);
  }

  return successResponse(c, {
    links: linksRows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// ─── POST /api/links ─────────────────────────────────────────────

links.post("/", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));

  const url = sanitize(input.url || "");
  const title = sanitize(input.title || "");
  const description = sanitize(input.description || "");
  const icon = sanitize(input.icon || "");
  const isPublic = input.is_public ? 1 : 0;
  const categoryId = input.category_id || null;
  let displayOrder =
    input.display_order != null ? parseInt(input.display_order, 10) : null;
  if (Number.isNaN(displayOrder)) displayOrder = null;
  let directRedirect = input.direct_redirect ? 1 : 0;
  const tags = input.tags || [];

  if (!url || !isValidUrl(url))
    return errorResponse(c, "Valid URL is required");
  if (!title) return errorResponse(c, "Title is required");

  // Length validation
  if (url.length > MAX_LENGTHS.url)
    return errorResponse(
      c,
      `URL must not exceed ${MAX_LENGTHS.url} characters`,
    );
  if (title.length > MAX_LENGTHS.title)
    return errorResponse(
      c,
      `Title must not exceed ${MAX_LENGTHS.title} characters`,
    );
  if (description.length > MAX_LENGTHS.description)
    return errorResponse(
      c,
      `Description must not exceed ${MAX_LENGTHS.description} characters`,
    );
  if (icon.length > MAX_LENGTHS.icon)
    return errorResponse(
      c,
      `Icon must not exceed ${MAX_LENGTHS.icon} characters`,
    );

  // Inherit direct_redirect from category if not explicitly provided
  if (categoryId && input.direct_redirect === undefined) {
    const cat = db
      .prepare("SELECT direct_redirect_default FROM categories WHERE id = ?")
      .get(categoryId);
    if (cat && cat.direct_redirect_default)
      directRedirect = cat.direct_redirect_default;
  }

  // Unique hash
  let hash;
  do {
    hash = generateHash();
  } while (db.prepare("SELECT id FROM links WHERE hash = ?").get(hash));

  const info = db
    .prepare(
      `INSERT INTO links (user_id, hash, url, title, description, icon, is_public, category_id, display_order, direct_redirect)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      c.userId,
      hash,
      url,
      title,
      description,
      icon,
      isPublic,
      categoryId,
      displayOrder,
      directRedirect,
    );

  if (tags.length) syncTags(db, info.lastInsertRowid, tags, c.userId);

  const link = db
    .prepare("SELECT * FROM links WHERE id = ?")
    .get(info.lastInsertRowid);
  return successResponse(c, { link }, "Link created successfully");
});

// ─── PUT /api/links?id= ─────────────────────────────────────────

links.put("/", requireAuth(), async (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Link ID is required");

  const existing = db
    .prepare("SELECT * FROM links WHERE id = ? AND user_id = ?")
    .get(id, c.userId);
  if (!existing) return errorResponse(c, "Link not found", 404);

  const input = await c.req.json().catch(() => ({}));

  const url = sanitize(input.url ?? existing.url);
  const title = sanitize(input.title ?? existing.title);
  const description = sanitize(input.description ?? existing.description);
  const icon = sanitize(input.icon ?? existing.icon);
  const isPublic =
    input.is_public !== undefined
      ? input.is_public
        ? 1
        : 0
      : existing.is_public;
  const categoryId =
    input.category_id !== undefined ? input.category_id : existing.category_id;
  let displayOrder =
    input.display_order !== undefined
      ? input.display_order != null
        ? parseInt(input.display_order, 10)
        : null
      : existing.display_order;
  if (Number.isNaN(displayOrder)) displayOrder = null;
  const directRedirect =
    input.direct_redirect !== undefined
      ? input.direct_redirect
        ? 1
        : 0
      : existing.direct_redirect || 0;

  if (!url || !isValidUrl(url))
    return errorResponse(c, "Valid URL is required");
  if (!title) return errorResponse(c, "Title is required");

  // Length validation
  if (url.length > MAX_LENGTHS.url)
    return errorResponse(
      c,
      `URL must not exceed ${MAX_LENGTHS.url} characters`,
    );
  if (title.length > MAX_LENGTHS.title)
    return errorResponse(
      c,
      `Title must not exceed ${MAX_LENGTHS.title} characters`,
    );
  if (description.length > MAX_LENGTHS.description)
    return errorResponse(
      c,
      `Description must not exceed ${MAX_LENGTHS.description} characters`,
    );
  if (icon.length > MAX_LENGTHS.icon)
    return errorResponse(
      c,
      `Icon must not exceed ${MAX_LENGTHS.icon} characters`,
    );

  db.prepare(
    `UPDATE links
     SET url = ?, title = ?, description = ?, icon = ?, is_public = ?,
         category_id = ?, display_order = ?, direct_redirect = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(
    url,
    title,
    description,
    icon,
    isPublic,
    categoryId,
    displayOrder,
    directRedirect,
    id,
  );

  if (input.tags !== undefined) {
    syncTags(db, id, input.tags, c.userId);
  }

  const link = db.prepare("SELECT * FROM links WHERE id = ?").get(id);
  return successResponse(c, { link }, "Link updated successfully");
});

// ─── DELETE /api/links?id= ──────────────────────────────────────

links.delete("/", requireAuth(), (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Link ID is required");

  const existing = db
    .prepare("SELECT * FROM links WHERE id = ? AND user_id = ?")
    .get(id, c.userId);
  if (!existing) return errorResponse(c, "Link not found", 404);

  db.prepare("DELETE FROM links WHERE id = ?").run(id);
  return successResponse(c, {}, "Link deleted successfully");
});

export default links;
