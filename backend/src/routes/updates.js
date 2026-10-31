/**
 * In-app updates — admin only (UPDATE_ADMIN_EMAILS). See lib/updates.js.
 *
 * Endpoints:
 *   GET  /api/updates           → version, what an update would bring, last result, history
 *   POST /api/updates/update    → update to the latest main (no body: the
 *                                 updater decides what to install)
 *   POST /api/updates/rollback  → back to the version before the last update
 *   POST /api/updates/check     → look for a new version now (no body; no
 *                                 fresh sign-in needed, as it changes nothing)
 *
 * Anyone who isn't an admin gets 404, as if the feature didn't exist.
 * Starting anything also needs a sign-in within UPDATE_REAUTH_MINUTES and a
 * same-site Origin header, on top of the JSON-only CSRF guard.
 */

import { Hono } from "hono";
import config from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { errorResponse, getClientIp, isDevSetup } from "../lib/helpers.js";
import {
  isUpdateAdmin,
  hasFreshLogin,
  readStatus,
  syncResults,
  history,
  requestUpdate,
  requestCheck,
  UpdateError,
} from "../lib/updates.js";

const updates = new Hono();

updates.use("*", requireAuth(), async (c, next) => {
  if (!isUpdateAdmin(c.userId)) return errorResponse(c, "Not found", 404);
  c.header("Cache-Control", "private, no-store");
  await next();
});

updates.get("/", (c) => {
  const status = readStatus();
  syncResults(status);
  return c.json({
    success: true,
    app_version: config.appVersion,
    built_commit: config.gitCommit || null,
    fresh_login: hasFreshLogin(c.session),
    reauth_minutes: config.updateReauthMinutes,
    ...status,
    history: history(),
  });
});

// Exactly SITE_URL's origin (scheme, host and port). Local dev servers on
// another port are allowed only in development.
function sameSite(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.origin === new URL(config.siteUrl).origin) return true;
    return isDevSetup() && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function originGuard(c) {
  if (!sameSite(c.req.header("origin"))) {
    return errorResponse(c, "This request must come from the app itself", 403);
  }
  return null;
}

function guard(c) {
  const bad = originGuard(c);
  if (bad) return bad;
  if (!hasFreshLogin(c.session)) {
    return c.json(
      { error: `Sign in again to confirm. Updates need a sign-in from the last ${config.updateReauthMinutes} minutes.`, reauth_required: true },
      403,
    );
  }
  return null;
}

function start(c, action) {
  try {
    const { id } = requestUpdate({ action, userId: c.userId, ip: getClientIp(c) });
    return c.json({ success: true, message: "Started", id }, 202);
  } catch (err) {
    if (err instanceof UpdateError) return errorResponse(c, err.message, err.status);
    throw err;
  }
}

// None of these endpoints reads a request body
updates.post("/update", (c) => guard(c) || start(c, "update"));

updates.post("/rollback", (c) => guard(c) || start(c, "rollback"));

updates.post("/check", (c) => {
  const bad = originGuard(c);
  if (bad) return bad;
  try {
    return c.json({ success: true, ...requestCheck() }, 202);
  } catch (err) {
    if (err instanceof UpdateError) return errorResponse(c, err.message, err.status);
    throw err;
  }
});

export default updates;
