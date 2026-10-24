/**
 * Simple cookie-based session middleware for Hono.
 *
 * Uses an httpOnly cookie holding a random session ID.
 * Session data is stored in the SQLite `sessions` table, so logins survive
 * restarts and redeploys.
 */

import crypto from "node:crypto";
import config from "../config.js";
import { getDb, hasDb } from "../lib/database.js";

/**
 * SQLite-backed session store with a small Map-like API:
 * sessionId → { data, expiresAt }
 */
const sessions = {
  get(id) {
    const row = getDb()
      .prepare("SELECT data, expires_at FROM sessions WHERE id = ?")
      .get(id);
    if (!row) return undefined;
    return { data: JSON.parse(row.data), expiresAt: row.expires_at };
  },
  set(id, session) {
    getDb()
      .prepare(
        "INSERT OR REPLACE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      )
      .run(id, JSON.stringify(session.data), session.expiresAt);
    return this;
  },
  delete(id) {
    getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
  },
  clear() {
    if (hasDb()) getDb().prepare("DELETE FROM sessions").run();
  },
  deleteExpired(now = Date.now()) {
    if (hasDb()) {
      getDb().prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
    }
  },
};

const COOKIE_NAME = config.sessionName;
const LIFETIME_MS = config.sessionLifetime * 1000;

/**
 * Clean expired sessions periodically.
 */
setInterval(() => sessions.deleteExpired(), 60_000).unref();

/**
 * Hono middleware that attaches `c.session` helpers.
 */
export function sessionMiddleware() {
  return async (c, next) => {
    // Parse session cookie
    const cookieHeader = c.req.header("cookie") || "";
    let sessionId = parseCookie(cookieHeader, COOKIE_NAME);
    let session = sessionId ? sessions.get(sessionId) : null;
    let dirty = false;

    // Validate session exists and is not expired
    if (!session || session.expiresAt < Date.now()) {
      sessionId = null;
      session = null;
    }

    // Expose session helpers on context
    c.session = {
      get(key) {
        return session?.data[key] ?? null;
      },
      set(key, value) {
        if (!session) {
          sessionId = crypto.randomBytes(32).toString("hex");
          session = { data: {}, expiresAt: Date.now() + LIFETIME_MS };
        }
        session.data[key] = value;
        dirty = true;
      },
      delete(key) {
        if (session && key in session.data) {
          delete session.data[key];
          dirty = true;
        }
      },
      destroy() {
        if (sessionId) sessions.delete(sessionId);
        session = null;
        sessionId = null;
      },
      regenerate() {
        const oldData = session?.data || {};
        if (sessionId) sessions.delete(sessionId);
        sessionId = crypto.randomBytes(32).toString("hex");
        session = { data: { ...oldData }, expiresAt: Date.now() + LIFETIME_MS };
        dirty = true;
      },
    };

    await next();

    // Persist changes made during the request
    if (dirty && sessionId && session) {
      sessions.set(sessionId, session);
    }

    // Determine if we should set the Secure flag
    // In production (non-localhost SITE_URL), always set Secure
    const isProduction =
      !config.siteUrl.includes("localhost") &&
      !config.siteUrl.includes("127.0.0.1");

    // Set / clear session cookie on response
    if (sessionId && session) {
      const cookie = buildCookie(COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: config.sessionLifetime,
        secure: isProduction,
      });
      c.header("Set-Cookie", cookie, { append: true });
    } else if (!session) {
      // Clear cookie
      const cookie = buildCookie(COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 0,
        secure: isProduction,
      });
      c.header("Set-Cookie", cookie, { append: true });
    }
  };
}

// ─── Cookie helpers ───────────────────────────────────────────────

function parseCookie(header, name) {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function buildCookie(name, value, opts = {}) {
  let cookie = `${name}=${value}`;
  if (opts.maxAge != null) cookie += `; Max-Age=${opts.maxAge}`;
  if (opts.path) cookie += `; Path=${opts.path}`;
  if (opts.httpOnly) cookie += "; HttpOnly";
  if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
  if (opts.secure) cookie += "; Secure";
  return cookie;
}

// ─── Exports for testing ──────────────────────────────────────────

export { sessions };
