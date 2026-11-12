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
  // Saved searches, shown as chips on View and Edit: [{ name, query }]
  saved_searches: [],
};

export const SAVED_SEARCH_LIMITS = { count: 30, name: 60, q: 200 };
const SORT_KEYS = new Set(["newest", "oldest", "title", "title_desc", "visits"]);

/**
 * Checks a saved_searches list. Each entry is { name, query } where query
 * holds only the View/Edit filters (category, tag, q, sort, toread) as
 * strings. Returns { value } or { error }; nothing unknown is kept.
 */
export function checkSavedSearches(list) {
  if (!Array.isArray(list)) return { error: "saved_searches must be a list" };
  if (list.length > SAVED_SEARCH_LIMITS.count)
    return { error: `You can keep up to ${SAVED_SEARCH_LIMITS.count} saved searches` };
  const value = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return { error: "Each saved search needs a name and filters" };
    const name = typeof entry.name === "string" ? sanitize(entry.name).trim() : "";
    if (!name || name.length > SAVED_SEARCH_LIMITS.name)
      return { error: `A saved search needs a name of up to ${SAVED_SEARCH_LIMITS.name} characters` };
    const query = entry.query;
    if (!query || typeof query !== "object" || Array.isArray(query))
      return { error: "Each saved search needs filters" };
    const clean = {};
    for (const [key, raw] of Object.entries(query)) {
      if (typeof raw !== "string") return { error: `Invalid saved search filter: ${key}` };
      const v = raw.trim();
      if (!v) continue;
      if (key === "category" && /^(\d{1,12}|uncategorized)$/.test(v)) clean.category = v;
      else if (key === "tag" && /^\d{1,12}$/.test(v)) clean.tag = v;
      else if (key === "q" && v.length <= SAVED_SEARCH_LIMITS.q) clean.q = sanitize(v);
      else if (key === "sort" && SORT_KEYS.has(v)) clean.sort = v;
      else if (key === "toread" && v === "1") clean.toread = "1";
      else return { error: `Invalid saved search filter: ${key}` };
    }
    if (!Object.keys(clean).length) return { error: "A saved search needs at least one filter" };
    value.push({ name, query: clean });
  }
  return { value };
}

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

  if (input.saved_searches !== undefined) {
    const checked = checkSavedSearches(input.saved_searches);
    if (checked.error) return errorResponse(c, checked.error);
    current.saved_searches = checked.value;
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
