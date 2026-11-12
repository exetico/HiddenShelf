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
  brand_color: "#687061",
  // Phones: a search box floating at the bottom of every page. Off unless
  // the user turns it on.
  floating_search: false,
};

// Settings that no longer exist, dropped when settings are read or saved.
// links_per_page went when the app started loading the whole shelf at once.
const RETIRED = ["links_per_page"];
// Stored settings miss anything added since they were saved: defaults fill in.
function withoutRetired(settings) {
  const clean = { ...DEFAULT_SETTINGS, ...settings };
  for (const key of RETIRED) delete clean[key];
  return clean;
}

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

  return successResponse(c, { settings: withoutRetired(JSON.parse(row.settings)) });
});

// ─── PUT /api/user_settings ──────────────────────────────────────

settings.put("/", requireAuth(), async (c) => {
  const db = getDb();
  const input = await c.req.json().catch(() => ({}));

  const row = db
    .prepare("SELECT settings FROM user_settings WHERE user_id = ?")
    .get(c.userId);
  const current = row ? withoutRetired(JSON.parse(row.settings)) : { ...DEFAULT_SETTINGS };

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

  // Only a real true/false; anything else is refused rather than guessed
  if (input.floating_search !== undefined) {
    if (typeof input.floating_search !== "boolean") {
      return errorResponse(c, "Invalid floating_search value. Must be true or false");
    }
    current.floating_search = input.floating_search;
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
