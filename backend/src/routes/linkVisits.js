/**
 * Link visits routes — log public visits, get stats.
 *
 * Endpoint mapping:
 *   POST /api/link_visits               → log a visit (public)
 *   GET  /api/link_visits?link_id=      → stats for a link (auth)
 *   GET  /api/link_visits               → summary for all public links (auth)
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import {
  sanitize,
  maskIpAddress,
  parseUserAgent,
  getClientIp,
  successResponse,
  errorResponse,
} from "../lib/helpers.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const linkVisits = new Hono();

// ─── POST /api/link_visits — log visit (public) ─────────────────

linkVisits.post("/", async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));
  const hash = sanitize(input.hash || "");

  if (!hash) return errorResponse(c, "Link hash required");

  const link = db
    .prepare("SELECT id FROM links WHERE hash = ? AND is_public = 1")
    .get(hash);
  if (!link) return errorResponse(c, "Link not found or is private", 404);

  const ip = getClientIp(c);
  const maskedIp = maskIpAddress(ip);
  const ua = c.req.header("user-agent") || "";
  const parsed = parseUserAgent(ua);
  const referer = c.req.header("referer") || null;

  db.prepare(
    "INSERT INTO link_visits (link_id, ip_masked, user_agent, browser, os, referer) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    link.id,
    maskedIp,
    ua.substring(0, 500),
    parsed.browser,
    parsed.os,
    referer,
  );

  return successResponse(c, {}, "Visit logged");
});

// ─── GET /api/link_visits ────────────────────────────────────────

linkVisits.get("/", requireAuth(), (c) => {
  const db = getDb();
  const linkId = c.req.query("link_id");
  let days = parseInt(c.req.query("days") || "30", 10);
  days = Math.min(Math.max(days, 1), 365);

  // ── Stats for a single link ──
  if (linkId) {
    const link = db
      .prepare("SELECT * FROM links WHERE id = ? AND user_id = ?")
      .get(linkId, c.userId);
    if (!link) return errorResponse(c, "Link not found", 404);

    const visits = db
      .prepare(
        `SELECT * FROM link_visits
       WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
       ORDER BY visited_at DESC
       LIMIT 500`,
      )
      .all(linkId, days);

    const stats = db
      .prepare(
        `SELECT COUNT(*) as total_visits,
              COUNT(DISTINCT ip_masked) as unique_visitors
       FROM link_visits
       WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')`,
      )
      .get(linkId, days);

    const browsers = db
      .prepare(
        `SELECT browser, COUNT(*) as count
       FROM link_visits
       WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
       GROUP BY browser
       ORDER BY count DESC`,
      )
      .all(linkId, days);

    const operatingSystems = db
      .prepare(
        `SELECT os, COUNT(*) as count
       FROM link_visits
       WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
       GROUP BY os
       ORDER BY count DESC`,
      )
      .all(linkId, days);

    const dailyVisits = db
      .prepare(
        `SELECT date(visited_at) as date, COUNT(*) as count
       FROM link_visits
       WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
       GROUP BY date(visited_at)
       ORDER BY date DESC`,
      )
      .all(linkId, days);

    return successResponse(c, {
      visits,
      stats: {
        total_visits: stats.total_visits,
        unique_visitors: stats.unique_visitors,
        browsers,
        operating_systems: operatingSystems,
        daily_visits: dailyVisits,
      },
    });
  }

  // ── Summary for all public links ──
  const summary = db
    .prepare(
      `SELECT l.id, l.title, l.hash, COUNT(lv.id) as visit_count
     FROM links l
     LEFT JOIN link_visits lv ON l.id = lv.link_id AND lv.visited_at >= datetime('now', '-' || ? || ' days')
     WHERE l.user_id = ? AND l.is_public = 1
     GROUP BY l.id
     ORDER BY visit_count DESC`,
    )
    .all(days, c.userId);

  const totalVisits = db
    .prepare(
      `SELECT COUNT(*) as count FROM link_visits lv
     JOIN links l ON lv.link_id = l.id
     WHERE l.user_id = ? AND lv.visited_at >= datetime('now', '-' || ? || ' days')`,
    )
    .get(c.userId, days);

  return successResponse(c, {
    summary,
    total_visits: totalVisits.count,
    days,
  });
});

export default linkVisits;
