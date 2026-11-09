/**
 * Config route — public endpoint returning app metadata.
 *
 * Endpoint: GET /api/config
 */

import { Hono } from "hono";
import config from "../config.js";
import { signupMode } from "../lib/access.js";

const configRoute = new Hono();

configRoute.get("/", (c) => {
  return c.json({
    success: true,
    message: "Success",
    app_version: config.appVersion,
    site_name: config.siteName,
    signup_enabled: signupMode() === "open",
    // open, approval (new people can ask to join) or invite (admins add people)
    signup_mode: signupMode(),
    email_login_enabled: config.emailLoginEnabled,
    google_auth_enabled: !!(config.googleClientId && config.googleClientSecret),
  });
});

export default configRoute;
