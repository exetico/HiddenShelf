/**
 * Links routes — CRUD for links with tags, pagination, search.
 *
 * Endpoint mapping:
 *   GET    /api/links                → list (paginated, searchable)
 *   GET    /api/links?id=            → single link (auth)
 *   GET    /api/links?hash=          → public link by hash
 *   GET    /api/links?duplicate_of=  → own links with the same URL (auth)
 *   GET    /api/links?random=1       → one random own link (auth)
 *   GET    /api/links?favorites=1    → all own favorite links (auth)
 *   GET    /api/links?trash=1        → own links in the trash (auth)
 *   POST   /api/links                → create
 *   POST   /api/links/restore?id=    → take a link out of the trash
 *   PUT    /api/links?id=            → update (incl. is_favorite)
 *   PUT    /api/links/order          → set the order of some links {ids: [...]}
 *   DELETE /api/links?id=            → move to the trash
 *   DELETE /api/links?id=&permanent=1 → delete a link in the trash for good
 *   DELETE /api/links/trash          → empty the trash
 *
 * Deleted links wait in the trash for TRASH_DAYS days, then go for good.
 * Every query for links on the shelf filters on deleted_at IS NULL.
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

export const TRASH_DAYS = 30;

// Remove links that have been in the trash longer than TRASH_DAYS
function purgeOldTrash(db, userId) {
  db.prepare(
    `DELETE FROM links WHERE user_id = ? AND deleted_at IS NOT NULL
       AND deleted_at < datetime('now', '-' || ? || ' days')`,
  ).run(userId, TRASH_DAYS);
}

// Attach tags and visit counts to a list of links (one query each)
function attachTagsAndVisits(db, rows) {
  if (!rows.length) return;
  const linkIds = rows.map((l) => l.id);
  const placeholders = linkIds.map(() => "?").join(",");

  const tagRows = db
    .prepare(
      `SELECT lt.link_id, t.* FROM tags t
       JOIN link_tags lt ON t.id = lt.tag_id
       WHERE lt.link_id IN (${placeholders})`,
    )
    .all(...linkIds);
  const tagsByLink = new Map();
  for (const row of tagRows) {
    if (!tagsByLink.has(row.link_id)) tagsByLink.set(row.link_id, []);
    tagsByLink.get(row.link_id).push(row);
  }

  const visitRows = db
    .prepare(
      `SELECT link_id, COUNT(*) as visit_count FROM link_visits
       WHERE link_id IN (${placeholders}) GROUP BY link_id`,
    )
    .all(...linkIds);
  const visitsByLink = new Map(visitRows.map((r) => [r.link_id, r.visit_count]));

  for (const link of rows) {
    link.tags = tagsByLink.get(link.id) || [];
    link.total_visits = visitsByLink.get(link.id) || 0;
  }
}

/**
 * Compare URLs the way people think of them: ignore http vs https, a
 * leading "www.", letter case in the host, a trailing slash and the
 * #fragment. Returns null for something that isn't a URL.
 */
export function normalizeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    const host = url.host.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}${url.search}`;
  } catch {
    return null;
  }
}

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
        // Public: only what the view page needs, never the owner's email
        `SELECT l.id, l.hash, l.url, l.title, l.description, l.icon,
              l.direct_redirect, l.created_at, l.updated_at
       FROM links l
       WHERE l.hash = ? AND l.is_public = 1 AND l.deleted_at IS NULL`,
      )
      .get(hash);

    if (!link) return errorResponse(c, "Link not found or is private", 404);
    link.tags = getTagsForLink(db, link.id);
    return successResponse(c, { link });
  }

  // Everything below requires auth
  if (!c.userId) return errorResponse(c, "Authentication required", 401);

  // ── "I'm feeling lucky": one random link ──
  if (c.req.query("random") !== undefined) {
    const link = db
      .prepare(
        "SELECT id, title, url FROM links WHERE user_id = ? AND deleted_at IS NULL ORDER BY RANDOM() LIMIT 1",
      )
      .get(c.userId);
    if (!link) return errorResponse(c, "Your shelf is empty", 404);
    return successResponse(c, { link });
  }

  // ── Favorites: all of them, whatever page they're on ──
  if (c.req.query("favorites") !== undefined) {
    const rows = db
      .prepare(
        `SELECT l.*, c.name as category_name, 0 as is_from_shared_category
       FROM links l
       LEFT JOIN categories c ON l.category_id = c.id
       WHERE l.user_id = ? AND l.is_favorite = 1 AND l.deleted_at IS NULL
       ORDER BY l.title COLLATE NOCASE ASC`,
      )
      .all(c.userId);
    attachTagsAndVisits(db, rows);
    return successResponse(c, { links: rows });
  }

  // ── Trash, newest deletion first ──
  if (c.req.query("trash") !== undefined) {
    purgeOldTrash(db, c.userId);
    const rows = db
      .prepare(
        `SELECT l.id, l.title, l.url, l.icon, l.deleted_at, c.name as category_name
       FROM links l
       LEFT JOIN categories c ON l.category_id = c.id
       WHERE l.user_id = ? AND l.deleted_at IS NOT NULL
       ORDER BY l.deleted_at DESC, l.id DESC`,
      )
      .all(c.userId);
    return successResponse(c, { links: rows, days: TRASH_DAYS });
  }

  // ── Duplicate check: is this URL already on the shelf? ──
  const duplicateOf = c.req.query("duplicate_of");
  if (duplicateOf !== undefined) {
    const wanted = normalizeUrl(duplicateOf);
    if (!wanted) return successResponse(c, { matches: [] });
    const excludeId = parseInt(c.req.query("exclude_id") || "0", 10);
    const matches = db
      .prepare(
        `SELECT l.id, l.title, l.url, c.name as category_name
       FROM links l
       LEFT JOIN categories c ON l.category_id = c.id
       WHERE l.user_id = ? AND l.id != ? AND l.deleted_at IS NULL`,
      )
      .all(c.userId, excludeId)
      .filter((link) => normalizeUrl(link.url) === wanted);
    return successResponse(c, { matches });
  }

  // ── Single by id ──
  if (id) {
    const link = db
      .prepare(
        `SELECT l.*, c.name as category_name
       FROM links l
       LEFT JOIN categories c ON l.category_id = c.id
       WHERE l.id = ? AND l.user_id = ? AND l.deleted_at IS NULL`,
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
  // ?offset= counts from what the client already has, so a page-size
  // change between requests can't skip or repeat links; ?page= still works
  const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
  const offset =
    Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : (page - 1) * limit;

  const categoryId = c.req.query("category_id") || null;
  const search = c.req.query("search") || null;
  const tagId = c.req.query("tag_id") || null;
  const includeShared = c.req.query("include_shared") !== "0";

  const where = ["l.deleted_at IS NULL"];
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

  if (tagId) {
    where.push("l.id IN (SELECT link_id FROM link_tags WHERE tag_id = ?)");
    params.push(tagId);
  }

  if (search) {
    // Tag names count too, so searching "work" finds links tagged work
    where.push(
      `(l.title LIKE ? OR l.description LIKE ? OR l.url LIKE ?
        OR EXISTS (SELECT 1 FROM link_tags lt JOIN tags t ON t.id = lt.tag_id
                   WHERE lt.link_id = l.id AND t.name LIKE ?))`,
    );
    const term = `%${search}%`;
    params.push(term, term, term, term);
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

  // Batch-fetch tags and visit counts for all links (avoids N+1)
  attachTagsAndVisits(db, linksRows);

  return successResponse(c, {
    links: linksRows,
    pagination: {
      page,
      limit,
      offset,
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

  // Validate category ownership
  if (categoryId) {
    const cat = db
      .prepare(
        "SELECT id, direct_redirect_default FROM categories WHERE id = ? AND user_id = ?",
      )
      .get(categoryId, c.userId);
    if (!cat)
      return errorResponse(c, "Category not found or access denied", 400);

    // Inherit direct_redirect from category if not explicitly provided
    if (input.direct_redirect === undefined && cat.direct_redirect_default) {
      directRedirect = cat.direct_redirect_default;
    }
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

// ─── PUT /api/links/order ────────────────────────────────────────
// Drag-and-drop: the links in `ids` get positions 1, 2, 3… in that order.
// Usually one category's links; other links keep their position.

links.put("/order", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(input.ids) ? input.ids.map(Number) : null;
  if (!ids || !ids.length || ids.some((id) => !Number.isInteger(id)))
    return errorResponse(c, "ids must be a list of link IDs");
  if (ids.length > 1000) return errorResponse(c, "Too many links at once");
  if (new Set(ids).size !== ids.length)
    return errorResponse(c, "ids must not repeat a link");

  const placeholders = ids.map(() => "?").join(",");
  const ownCount = db
    .prepare(
      `SELECT COUNT(*) as n FROM links WHERE user_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
    )
    .get(c.userId, ...ids).n;
  if (ownCount !== ids.length)
    return errorResponse(c, "You can only reorder your own links", 403);

  const update = db.prepare(
    "UPDATE links SET display_order = ? WHERE id = ? AND user_id = ?",
  );
  db.transaction(() => {
    ids.forEach((id, index) => update.run(index + 1, id, c.userId));
  })();

  return successResponse(c, {}, "Link order saved");
});

links.put("/", requireAuth(), async (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Link ID is required");

  const existing = db
    .prepare(
      "SELECT * FROM links WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    )
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
  const isFavorite =
    input.is_favorite !== undefined
      ? input.is_favorite
        ? 1
        : 0
      : existing.is_favorite || 0;

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

  // Validate category ownership on update
  if (categoryId && categoryId !== existing.category_id) {
    const cat = db
      .prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?")
      .get(categoryId, c.userId);
    if (!cat)
      return errorResponse(c, "Category not found or access denied", 400);
  }

  db.prepare(
    `UPDATE links
     SET url = ?, title = ?, description = ?, icon = ?, is_public = ?,
         category_id = ?, display_order = ?, direct_redirect = ?, is_favorite = ?,
         updated_at = CURRENT_TIMESTAMP
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
    isFavorite,
    id,
  );

  if (input.tags !== undefined) {
    syncTags(db, id, input.tags, c.userId);
  }

  const link = db.prepare("SELECT * FROM links WHERE id = ?").get(id);
  return successResponse(c, { link }, "Link updated successfully");
});

// ─── POST /api/links/restore?id= ────────────────────────────────

links.post("/restore", requireAuth(), (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Link ID is required");

  const info = db
    .prepare(
      "UPDATE links SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL",
    )
    .run(id, c.userId);
  if (!info.changes) return errorResponse(c, "Link not found in the trash", 404);

  const link = db.prepare("SELECT * FROM links WHERE id = ?").get(id);
  return successResponse(c, { link }, "Link restored");
});

// ─── DELETE /api/links/trash ────────────────────────────────────

links.delete("/trash", requireAuth(), (c) => {
  const db = getDb();
  const info = db
    .prepare("DELETE FROM links WHERE user_id = ? AND deleted_at IS NOT NULL")
    .run(c.userId);
  return successResponse(c, { deleted: info.changes }, "Trash emptied");
});

// ─── DELETE /api/links?id= ──────────────────────────────────────
// Moves the link to the trash; with &permanent=1 a link already in the
// trash is deleted for good.

links.delete("/", requireAuth(), (c) => {
  const db = getDb();
  const id = c.req.query("id");
  if (!id) return errorResponse(c, "Link ID is required");

  const existing = db
    .prepare("SELECT * FROM links WHERE id = ? AND user_id = ?")
    .get(id, c.userId);
  if (!existing) return errorResponse(c, "Link not found", 404);

  if (c.req.query("permanent") !== undefined) {
    if (!existing.deleted_at)
      return errorResponse(c, "Move the link to the trash first");
    db.prepare("DELETE FROM links WHERE id = ?").run(id);
    return successResponse(c, {}, "Link deleted for good");
  }

  if (existing.deleted_at) return errorResponse(c, "Link not found", 404);
  db.prepare(
    "UPDATE links SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(id);
  return successResponse(c, {}, "Link moved to the trash");
});

export default links;
