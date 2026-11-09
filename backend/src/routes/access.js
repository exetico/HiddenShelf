/**
 * Ask to join — see lib/access.js for how it works and why it's safe.
 *
 * For someone new (no account; uses the email they just proved by signing in):
 *   GET  /api/access/me        → { mode, email, status, can_ask }
 *   POST /api/access/request   → ask to join { note? }
 *
 * For admins (UPDATE_ADMIN_EMAILS; anyone else gets 404):
 *   GET    /api/access/admin              → { mode, entries }
 *   POST   /api/access/admin/invite       → let an email in ahead of time { email }
 *   POST   /api/access/admin/:id/approve  → approve (emails the person once)
 *   POST   /api/access/admin/:id/deny     → deny (sends nothing)
 *   DELETE /api/access/admin/:id          → remove from the list
 * Admin changes also need a same-site Origin header.
 */

import { Hono } from "hono";
import config from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import {
  errorResponse,
  getClientIp,
  isSameSiteOrigin,
  isValidEmail,
  sanitize,
  MAX_LENGTHS,
} from "../lib/helpers.js";
import { isUpdateAdmin } from "../lib/updates.js";
import {
  signupMode,
  joinEmailFrom,
  entryFor,
  askToJoin,
  listEntries,
  decide,
  invite,
  removeEntry,
  AccessError,
} from "../lib/access.js";

const access = new Hono();

// ─── Rate limit for asking (per IP; each email can only ask once anyway) ──

export const REQUEST_LIMIT = { max: 5, window: 60 * 60 * 1000 };
export const requestAttempts = new Map(); // ip → { count, resetAt }

function takeRequestAttempt(ip) {
  const now = Date.now();
  let entry = requestAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + REQUEST_LIMIT.window };
    requestAttempts.set(ip, entry);
  }
  if (entry.count >= REQUEST_LIMIT.max) return Math.ceil((entry.resetAt - now) / 1000);
  entry.count++;
  return 0;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestAttempts) if (entry.resetAt <= now) requestAttempts.delete(key);
}, 60_000).unref?.();

function fail(c, err) {
  if (err instanceof AccessError) return errorResponse(c, err.message, err.status);
  throw err;
}

// ─── Someone new ─────────────────────────────────────────────────

access.get("/me", (c) => {
  c.header("Cache-Control", "private, no-store");
  const mode = signupMode();
  const email = joinEmailFrom(c.session);
  // Only the visitor's own proved email: nothing here says anything about
  // any other address
  const status = email ? entryFor(email)?.status || "none" : null;
  return c.json({
    success: true,
    mode,
    email,
    status,
    can_ask: Boolean(email) && mode === "approval" && status === "none",
  });
});

access.post("/request", async (c) => {
  const email = joinEmailFrom(c.session);
  if (!email) {
    return errorResponse(c, "Sign in with your email or Google first, then ask to join.", 401);
  }
  const wait = takeRequestAttempt(getClientIp(c));
  if (wait) {
    c.header("Retry-After", String(wait));
    return c.json(
      { success: false, error: "That's a lot of requests from your network. Please try again later.", retry_after: wait },
      429,
    );
  }
  const body = await c.req.json().catch(() => ({}));
  try {
    const status = askToJoin(email, body.note ?? null);
    return c.json({ success: true, status });
  } catch (err) {
    return fail(c, err);
  }
});

// ─── Admins ──────────────────────────────────────────────────────

// "/admin/*" also matches "/admin" itself
access.use("/admin/*", requireAuth(), async (c, next) => {
  if (!isUpdateAdmin(c.userId)) return errorResponse(c, "Not found", 404);
  c.header("Cache-Control", "private, no-store");
  if (c.req.method !== "GET" && !isSameSiteOrigin(c.req.header("origin"))) {
    return errorResponse(c, "This request must come from the app itself", 403);
  }
  await next();
});

access.get("/admin", (c) =>
  c.json({ success: true, mode: signupMode(), configured_mode: config.signupMode, entries: listEntries() }),
);

access.post("/admin/invite", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = sanitize(typeof body.email === "string" ? body.email : "");
  if (email.length > MAX_LENGTHS.email || !isValidEmail(email)) {
    return errorResponse(c, "Enter a valid email address");
  }
  try {
    return c.json({ success: true, entry: invite(email, c.userId) });
  } catch (err) {
    return fail(c, err);
  }
});

function entryId(c) {
  const id = Number(c.req.param("id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

for (const [action, status] of [["approve", "approved"], ["deny", "denied"]]) {
  access.post(`/admin/:id/${action}`, (c) => {
    const id = entryId(c);
    if (!id) return errorResponse(c, "That request is gone.", 404);
    try {
      return c.json({ success: true, entry: decide(id, status, c.userId) });
    } catch (err) {
      return fail(c, err);
    }
  });
}

access.delete("/admin/:id", (c) => {
  const id = entryId(c);
  if (!id) return errorResponse(c, "That entry is gone.", 404);
  try {
    removeEntry(id);
    return c.json({ success: true });
  } catch (err) {
    return fail(c, err);
  }
});

export default access;
