/**
 * In-app updates — admin only (UPDATE_ADMIN_EMAILS). See lib/updates.js.
 *
 * Endpoints:
 *   GET  /api/updates           → version, what an update would bring, last result, history
 *   POST /api/updates/update    → { commit } the target the admin saw; starts an update
 *   POST /api/updates/rollback  → back to the version before the last update
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

function guard(c) {
  if (!sameSite(c.req.header("origin"))) {
    return errorResponse(c, "This request must come from the app itself", 403);
  }
  if (!hasFreshLogin(c.session)) {
    return c.json(
      { error: `Sign in again to confirm. Updates need a sign-in from the last ${config.updateReauthMinutes} minutes.`, reauth_required: true },
      403,
    );
  }
  return null;
}

function start(c, action, commit) {
  try {
    const { id } = requestUpdate({ action, commit, userId: c.userId, ip: getClientIp(c) });
    return c.json({ success: true, message: "Started", id }, 202);
  } catch (err) {
    if (err instanceof UpdateError) return errorResponse(c, err.message, err.status);
    throw err;
  }
}

updates.post("/update", async (c) => {
  const refused = guard(c);
  if (refused) return refused;
  const body = await c.req.json().catch(() => ({}));
  return start(c, "update", typeof body.commit === "string" ? body.commit : "");
});

updates.post("/rollback", (c) => {
  const refused = guard(c);
  if (refused) return refused;
  return start(c, "rollback", null);
});

export default updates;
