/**
 * Hidden Shelf — Hono server entry point.
 *
 * Serves:
 *   /api/*            → API routes (auth, links, categories, tags, shares, settings, visits, config)
 *   /h/:hash          → Public link page, or a redirect for direct-redirect links
 *   /, /dashboard, …  → Vue app (clean URLs, see routes/appShell.js)
 *   /public/app/*     → Built Vue frontend (old hash URLs still work)
 *   /public/view.html → Old link page URL, redirects to /h/:hash
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "./config.js";
import { initDb } from "./lib/database.js";
import { sessionMiddleware } from "./middleware/session.js";
import { requireJsonBody } from "./middleware/requireJson.js";
import { baseUrl, allowedCorsOrigin } from "./lib/helpers.js";

// Routes
import authRoutes from "./routes/auth.js";
import linksRoutes from "./routes/links.js";
import categoriesRoutes from "./routes/categories.js";
import tagsRoutes from "./routes/tags.js";
import sharesRoutes from "./routes/shares.js";
import { appShellRoutes } from "./routes/appShell.js";
import settingsRoutes from "./routes/settings.js";
import linkVisitsRoutes from "./routes/linkVisits.js";
import configRoutes from "./routes/config.js";
import accountRoutes from "./routes/account.js";
import { publicLinkRoutes } from "./routes/publicLink.js";

// ─── Initialise database ────────────────────────────────────────

initDb();

// ─── App ─────────────────────────────────────────────────────────

const app = new Hono();

// ─── Global middleware ───────────────────────────────────────────

app.use(
  "*",
  cors({
    // Same hostname as SITE_URL; localhost dev servers only in development
    origin: allowedCorsOrigin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  }),
);

app.use("*", sessionMiddleware());
app.use("/api/*", requireJsonBody());

// ─── API routes ──────────────────────────────────────────────────

app.route("/api/auth", authRoutes);
app.route("/api/links", linksRoutes);
app.route("/api/categories", categoriesRoutes);
app.route("/api/tags", tagsRoutes);
app.route("/api/category_shares", sharesRoutes);
app.route("/api/user_settings", settingsRoutes);
app.route("/api/link_visits", linkVisitsRoutes);
app.route("/api/config", configRoutes);
app.route("/api/account", accountRoutes);

// ─── Resolve project root (one level above backend/) ─────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

// ─── Public links: /h/:hash ─────────────────────────────────────

app.route(
  "/",
  publicLinkRoutes({
    templatePath: path.join(projectRoot, "public", "app", "link.html"),
  }),
);

// ─── Static files ────────────────────────────────────────────────

// Serve built Vue app from public/app/
app.use("/public/app/*", serveStatic({ root: projectRoot }));

// The Vue build references its bundles as /assets/... (Vite base "/", which
// httpClient also uses as the API prefix), while index.html is served from
// /public/app/. Serve those bundles where the page asks for them.
app.use(
  "/assets/*",
  serveStatic({ root: path.join(projectRoot, "public", "app") }),
);

// Serve public assets (favicon.png)
app.use("/public/*", serveStatic({ root: projectRoot }));

// Serve favicon from root
app.use(
  "/favicon.png",
  serveStatic({ root: path.join(projectRoot, "public") }),
);

// ─── App routes: /, /dashboard, /view, … serve the Vue app ────────

app.route(
  "/",
  appShellRoutes({
    indexPath: path.join(projectRoot, "public", "app", "index.html"),
  }),
);

// ─── Old URL compat: redirect /public/index.html to Vue app ────

app.get("/public/index.html", (c) =>
  c.redirect(baseUrl("/dashboard"), 301),
);

// ─── Error handling ──────────────────────────────────────────────

app.onError((err, c) => {
  console.error("[server]", err);
  if (config.debugMode) {
    return c.json({ error: err.message }, 500);
  }
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

// ─── Start server ────────────────────────────────────────────────

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(
      `[server] Hidden Shelf running on http://localhost:${info.port}`,
    );
    const googleEnabled = Boolean(
      config.googleClientId && config.googleClientSecret,
    );
    if (!config.emailLoginEnabled && !googleEnabled) {
      console.error(
        "[server] ERROR: no way to log in. EMAIL_LOGIN_ENABLED=false and Google sign-in isn't configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).",
      );
    }
    if (
      googleEnabled &&
      !config.googleRedirectUri.endsWith("/api/auth/google/callback")
    ) {
      console.warn(
        `[server] WARNING: GOOGLE_REDIRECT_URI is ${config.googleRedirectUri}, but the callback is ${config.siteUrl}/api/auth/google/callback. Leave it empty to use that.`,
      );
    }
    // smtpbucket.com mailboxes are public, so login links sent there can be
    // read by anyone
    if (
      config.emailLoginEnabled &&
      config.smtpHost === "mail.smtpbucket.com" &&
      !/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(config.siteUrl)
    ) {
      console.warn(
        "[server] WARNING: SMTP_HOST is not set, so login emails go to the public test service smtpbucket.com. Set SMTP_* in .env before going live.",
      );
    }
  });
}

export default app;
