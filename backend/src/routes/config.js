/**
 * Config route — public endpoint returning app metadata.
 *
 * Endpoint: GET /api/config
 */

import { Hono } from "hono";
import config from "../config.js";

const configRoute = new Hono();

configRoute.get("/", (c) => {
  return c.json({
    success: true,
    message: "Success",
    app_version: config.appVersion,
    site_name: config.siteName,
    signup_enabled: config.signupEnabled,
    email_login_enabled: config.emailLoginEnabled,
    google_auth_enabled: !!(config.googleClientId && config.googleClientSecret),
  });
});

export default configRoute;
