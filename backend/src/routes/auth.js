/**
 * Auth routes — magic link login, verify, logout, me, Google OAuth.
 *
 * Endpoint mapping (preserves frontend API contract):
 *   POST /api/auth/login          → send magic link
 *   GET  /api/auth/verify         → verify token + redirect
 *   POST /api/auth/logout         → logout
 *   GET  /api/auth/me             → current user
 *   GET  /api/auth/google         → get Google OAuth URL
 *   GET  /api/auth/google/callback→ Google OAuth callback
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import { sendMagicLink } from "../lib/mailer.js";
import {
  generateToken,
  isValidEmail,
  sanitize,
  successResponse,
  errorResponse,
  baseUrl,
  isAllowedRedirectOrigin,
  getClientIp,
  safeReturnTo,
  returnToUrl,
  MAX_LENGTHS,
} from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";
import { isUpdateAdmin } from "../lib/updates.js";
import config from "../config.js";

const auth = new Hono();

// ─── Rate limiter for login endpoint ─────────────────────────────

// Fixed windows kept in memory (they reset when the server restarts).
// "ip:<address>" stops one visitor trying many addresses; the
// "email:<address>" ones stop many visitors flooding one inbox.
const loginAttempts = new Map(); // key → { count, resetAt }
const MINUTE = 60 * 1000;
export const LOGIN_LIMITS = {
  ip: [{ max: 10, window: 15 * MINUTE }],
  email: [
    { max: 1, window: MINUTE }, // one link at a time
    { max: 5, window: 60 * MINUTE },
  ],
};

/**
 * Checks every window for a key and counts the request only if all allow
 * it. Returns 0 when allowed, else the seconds until the next request is.
 */
function takeLoginAttempt(kind, value) {
  const now = Date.now();
  let wait = 0;
  const entries = LOGIN_LIMITS[kind].map(({ max, window }) => {
    const key = `${kind}:${window}:${value}`;
    let entry = loginAttempts.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + window };
      loginAttempts.set(key, entry);
    }
    if (entry.count >= max) wait = Math.max(wait, entry.resetAt - now);
    return entry;
  });
  if (wait) return Math.ceil(wait / 1000);
  for (const entry of entries) entry.count++;
  return 0;
}

function waitText(seconds) {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function tooManyRequests(c, seconds, message) {
  c.header("Retry-After", String(seconds));
  return c.json({ success: false, error: message, retry_after: seconds }, 429);
}

// Clean up rate limiter periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt <= now) loginAttempts.delete(key);
  }
}, 60_000).unref?.();

// ─── POST /login — request magic link ────────────────────────────

auth.post("/login", async (c) => {
  if (!config.emailLoginEnabled) {
    return errorResponse(c, "Email login is turned off on this server", 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const email = sanitize(body.email || "");
  const rawRedirect = body.redirect_origin || null;

  // Rate limit by IP
  const ipWait = takeLoginAttempt("ip", getClientIp(c));
  if (ipWait) {
    return tooManyRequests(
      c,
      ipWait,
      `That's a lot of sign-in requests from your network. Please try again in ${waitText(ipWait)}.`,
    );
  }

  // Stored in the session; a page path is never this long
  if (
    typeof body.return_to === "string" &&
    body.return_to &&
    body.return_to.length <= MAX_LENGTHS.returnTo
  ) {
    c.session.set("return_to", body.return_to);
  }

  if (email.length > MAX_LENGTHS.email || !isValidEmail(email)) {
    return errorResponse(c, "Invalid email address");
  }

  // Also limit per address, so one inbox can't be flooded from many IPs
  // The same answer whether or not the address has an account
  const emailWait = takeLoginAttempt("email", email.toLowerCase());
  if (emailWait) {
    return tooManyRequests(
      c,
      emailWait,
      `A sign-in link was already sent to this address. Check your inbox and spam folder, or ask for a new one in ${waitText(emailWait)}.`,
    );
  }

  // Validate redirect_origin to prevent open redirect
  const redirectOrigin = isAllowedRedirectOrigin(rawRedirect)
    ? rawRedirect
    : null;

  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + config.magicLinkExpiry * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");

  db.prepare(
    "INSERT INTO magic_tokens (email, token, expires_at, redirect_origin) VALUES (?, ?, ?, ?)",
  ).run(email, token, expiresAt, redirectOrigin);

  await sendMagicLink(email, token, redirectOrigin);

  return successResponse(c, {}, "Magic link sent to your email");
});

// ─── GET /verify — verify magic link token ───────────────────────

auth.get("/verify", async (c) => {
  if (!config.emailLoginEnabled) {
    return c.redirect(
      `${config.siteUrl}${baseUrl("/login")}?error=email_login_disabled`,
    );
  }
  const token = c.req.query("token") || "";
  if (!token) {
    return c.redirect(
      `${config.siteUrl}${baseUrl("/login")}?error=Token+is+required`,
    );
  }

  const db = getDb();
  const tokenData = db
    .prepare("SELECT * FROM magic_tokens WHERE token = ? AND used = 0")
    .get(token);

  if (!tokenData) {
    return c.redirect(
      `${config.siteUrl}${baseUrl("/login")}?error=Invalid+or+already+used+token`,
    );
  }

  // Dates are stored as UTC without Z suffix; re-add it so JS parses as UTC
  const expiresAt = new Date(tokenData.expires_at.replace(" ", "T") + "Z");
  if (expiresAt < new Date()) {
    return c.redirect(
      `${config.siteUrl}${baseUrl("/login")}?error=Token+has+expired`,
    );
  }

  // Mark used
  db.prepare("UPDATE magic_tokens SET used = 1 WHERE id = ?").run(tokenData.id);

  // Get or create user
  const email = tokenData.email;
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const isNewUser = !user;

  if (!user) {
    if (!config.signupEnabled) {
      return c.redirect(
        `${config.siteUrl}${baseUrl("/login")}?error=signup_disabled`,
      );
    }
    const result = db
      .prepare("INSERT INTO users (email) VALUES (?)")
      .run(email);
    user = { id: result.lastInsertRowid, email };
  }

  // Set session
  // Confirming who you are (admin updates) is not a new visit: no greeting
  const sameUser = Number(c.session.get("user_id")) === Number(user.id);
  c.session.set("user_id", user.id);
  c.session.set("user_email", email);
  // The app greets once after login (read and cleared by /me)
  if (!sameUser) c.session.set("welcome", isNewUser ? "new" : "back");
  // When this sign-in happened; admin updates ask for a recent one
  c.session.set("login_at", Date.now());
  c.session.regenerate();

  // Determine redirect
  // Only same-site destinations, so the login link can't be an open redirect
  const returnTo = safeReturnTo(c.session.get("return_to"));
  c.session.delete("return_to");

  const redirectOrigin = tokenData.redirect_origin;
  if (redirectOrigin && isAllowedRedirectOrigin(redirectOrigin)) {
    return c.redirect(returnToUrl(returnTo, redirectOrigin));
  }
  return c.redirect(returnToUrl(returnTo));
});

// ─── POST /logout ────────────────────────────────────────────────

auth.post("/logout", (c) => {
  c.session.destroy();
  return successResponse(c, {}, "Logged out successfully");
});

// ─── GET /me — current user ─────────────────────────────────────

auth.get("/me", requireAuth(), (c) => {
  const db = getDb();
  const user = db
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(c.userId);
  if (!user) return errorResponse(c, "User not found", 404);

  // Set by a fresh login; the app shows a greeting once
  const welcome = c.session.get("welcome") || null;
  if (welcome) c.session.delete("welcome");

  return successResponse(c, { user, welcome, can_update: isUpdateAdmin(user.id) });
});

// ─── GET /google — initiate Google OAuth ─────────────────────────

auth.get("/google", (c) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return errorResponse(c, "Google OAuth not configured", 500);
  }

  const rawRedirectOrigin = c.req.query("redirect_origin") || null;
  if (rawRedirectOrigin && isAllowedRedirectOrigin(rawRedirectOrigin)) {
    c.session.set("oauth_redirect_origin", rawRedirectOrigin);
  }

  // Where to land afterwards (checked by safeReturnTo when used), e.g.
  // back on the Admin page after confirming who you are
  const returnTo = c.req.query("return_to");
  if (returnTo && returnTo.length <= MAX_LENGTHS.returnTo) c.session.set("return_to", returnTo);

  const state = generateToken(16);
  c.session.set("oauth2state", state);

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return c.json({ success: true, authUrl });
});

// ─── GET /google/callback — Google OAuth callback ────────────────

auth.get("/google/callback", async (c) => {
  const loginUrl = `${config.siteUrl}${baseUrl("/login")}`;

  if (!config.googleClientId || !config.googleClientSecret) {
    return c.redirect(`${loginUrl}?error=oauth_not_configured`);
  }

  if (c.req.query("error")) {
    return c.redirect(`${loginUrl}?error=oauth_denied`);
  }

  const state = c.req.query("state");
  const savedState = c.session.get("oauth2state");
  if (!state || state !== savedState) {
    return c.redirect(`${loginUrl}?error=invalid_state`);
  }
  c.session.delete("oauth2state");

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: c.req.query("code"),
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return c.redirect(`${loginUrl}?error=oauth_failed`);
    }

    // Get user info
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const googleUser = await userInfoRes.json();
    // An unverified Google address proves nothing about who owns it, and
    // emails decide account linking and who may update the app
    if (!googleUser.email || googleUser.verified_email !== true) {
      return c.redirect(`${loginUrl}?error=oauth_failed`);
    }
    const email = googleUser.email;
    const googleId = googleUser.id;

    const db = getDb();

    let isNewUser = false;

    // Check existing OAuth user
    let user = db
      .prepare("SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?")
      .get("google", googleId);

    if (!user) {
      // Check existing email user
      user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (user) {
        // Link OAuth to existing account
        db.prepare(
          "UPDATE users SET oauth_provider = ?, oauth_id = ?, oauth_email = ? WHERE id = ?",
        ).run("google", googleId, email, user.id);
      } else {
        // New user
        if (!config.signupEnabled) {
          return c.redirect(`${loginUrl}?error=signup_disabled`);
        }
        const result = db
          .prepare(
            "INSERT INTO users (email, oauth_provider, oauth_id, oauth_email) VALUES (?, ?, ?, ?)",
          )
          .run(email, "google", googleId, email);
        isNewUser = true;
        user = { id: result.lastInsertRowid, email };
      }
    }

    // Set session
    const sameUser = Number(c.session.get("user_id")) === Number(user.id);
    c.session.set("user_id", user.id);
    c.session.set("user_email", email);
    if (!sameUser) c.session.set("welcome", isNewUser ? "new" : "back");
    // When this sign-in happened; admin updates ask for a recent one
    c.session.set("login_at", Date.now());
    c.session.regenerate();

    // Redirect
    const redirectOrigin = c.session.get("oauth_redirect_origin");
    c.session.delete("oauth_redirect_origin");

    const returnTo = safeReturnTo(c.session.get("return_to"));
    c.session.delete("return_to");

    if (redirectOrigin && isAllowedRedirectOrigin(redirectOrigin)) {
      return c.redirect(returnToUrl(returnTo, redirectOrigin));
    }
    return c.redirect(returnToUrl(returnTo));
  } catch (err) {
    console.error("[oauth] Google OAuth error:", err.message);
    return c.redirect(`${loginUrl}?error=oauth_failed`);
  }
});

export default auth;

// Export for testing
export { loginAttempts };
