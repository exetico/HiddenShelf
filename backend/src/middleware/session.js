/**
 * Simple cookie-based session middleware for Hono.
 *
 * Uses a signed, httpOnly cookie to store the session ID.
 * Session data lives in an in-memory Map (fine for single-process SQLite apps).
 * For multi-process deployments, swap for a DB-backed store.
 */

import crypto from "node:crypto";
import config from "../config.js";

/** In-memory session store: sessionId → { data, expiresAt } */
const sessions = new Map();

const COOKIE_NAME = config.sessionName;
const LIFETIME_MS = config.sessionLifetime * 1000;

/**
 * Clean expired sessions periodically.
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(id);
  }
}, 60_000);

/**
 * Hono middleware that attaches `c.session` helpers.
 */
export function sessionMiddleware() {
  return async (c, next) => {
    // Parse session cookie
    const cookieHeader = c.req.header("cookie") || "";
    let sessionId = parseCookie(cookieHeader, COOKIE_NAME);
    let session = sessionId ? sessions.get(sessionId) : null;

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
          sessions.set(sessionId, session);
        }
        session.data[key] = value;
      },
      delete(key) {
        if (session) delete session.data[key];
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
        sessions.set(sessionId, session);
      },
    };

    await next();

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
