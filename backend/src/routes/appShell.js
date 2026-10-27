/**
 * App shell routes — clean URLs for the Vue app.
 *
 * Endpoint mapping:
 *   GET /, /login, /dashboard, /view, /edit, /profile, /tools → the app's index.html
 *
 * The app uses history routing, so these paths reach the server on a reload
 * or a bookmark. Only the app's own routes are listed: /api, /h, /assets and
 * /public keep their handlers, and unknown paths still 404.
 * Old /public/app/index.html#/route URLs keep working; the app rewrites
 * them to the clean form when it starts.
 */

import fs from "node:fs";
import { Hono } from "hono";
import { withAbsoluteShareImage } from "../lib/helpers.js";

export const APP_ROUTES = ["/", "/login", "/dashboard", "/view", "/edit", "/profile", "/tools"];

export function appShellRoutes({ indexPath }) {
  const routes = new Hono();

  for (const route of APP_ROUTES) {
    routes.get(route, (c) => {
      // Read per request so a rebuilt frontend is picked up without a restart
      let html;
      try {
        html = fs.readFileSync(indexPath, "utf-8");
      } catch {
        return c.text("App not built. Run `make build-frontend`.", 503);
      }
      c.header("Cache-Control", "no-cache");
      return c.html(withAbsoluteShareImage(html));
    });
  }

  return routes;
}
