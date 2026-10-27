/**
 * User settings routes — get / update.
 *
 * Endpoint mapping:
 *   GET /api/user_settings      → get settings
 *   PUT /api/user_settings      → update settings
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import { sanitize, successResponse, errorResponse } from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";

const settings = new Hono();

const DEFAULT_SETTINGS = {
  links_per_page: 100,
  brand_color: "#687061",
};

// ─── GET /api/user_settings ──────────────────────────────────────

settings.get("/", requireAuth(), (c) => {
  const db = getDb();

  const row = db
    .prepare("SELECT settings FROM user_settings WHERE user_id = ?")
    .get(c.userId);

  if (!row) {
    const json = JSON.stringify(DEFAULT_SETTINGS);
    db.prepare(
      "INSERT INTO user_settings (user_id, settings) VALUES (?, ?)",
    ).run(c.userId, json);
    return successResponse(c, { settings: { ...DEFAULT_SETTINGS } });
  }

  return successResponse(c, { settings: JSON.parse(row.settings) });
});

// ─── PUT /api/user_settings ──────────────────────────────────────

settings.put("/", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));

  const row = db
    .prepare("SELECT settings FROM user_settings WHERE user_id = ?")
    .get(c.userId);
  const current = row ? JSON.parse(row.settings) : { ...DEFAULT_SETTINGS };

  // Validate links_per_page
  if (input.links_per_page !== undefined) {
    const validLimits = [20, 50, 100, 250, 500];
    const val = parseInt(input.links_per_page, 10);
    if (!validLimits.includes(val)) {
      return errorResponse(
        c,
        `Invalid links_per_page value. Must be one of: ${validLimits.join(", ")}`,
      );
    }
    current.links_per_page = val;
  }

  // Validate brand_color
  if (input.brand_color !== undefined) {
    const color = sanitize(input.brand_color);
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return errorResponse(
        c,
        "Invalid brand_color value. Must be a valid hex color (e.g., #687061)",
      );
    }
    current.brand_color = color;
  }

  const json = JSON.stringify(current);

  if (row) {
    db.prepare(
      "UPDATE user_settings SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
    ).run(json, c.userId);
  } else {
    db.prepare(
      "INSERT INTO user_settings (user_id, settings) VALUES (?, ?)",
    ).run(c.userId, json);
  }

  return successResponse(
    c,
    { settings: current },
    "Settings updated successfully",
  );
});

export default settings;
