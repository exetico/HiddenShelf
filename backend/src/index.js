/**
 * Hidden Shelf — Hono server entry point.
 *
 * Serves:
 *   /api/*            → API routes (auth, links, categories, tags, shares, settings, visits, config)
 *   /h/:hash          → Short-URL redirect for public links
 *   /public/app/*     → Built Vue frontend
 *   /public/view.html → Public link viewer (legacy Alpine.js page)
 *   /                 → Redirect to Vue app
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import config from "./config.js";
import { initDb, getDb } from "./lib/database.js";
import { sessionMiddleware } from "./middleware/session.js";
import { requireJsonBody } from "./middleware/requireJson.js";
import { baseUrl, allowedCorsOrigin } from "./lib/helpers.js";

// Routes
import authRoutes from "./routes/auth.js";
import linksRoutes from "./routes/links.js";
import categoriesRoutes from "./routes/categories.js";
import tagsRoutes from "./routes/tags.js";
import sharesRoutes from "./routes/shares.js";
import settingsRoutes from "./routes/settings.js";
import linkVisitsRoutes from "./routes/linkVisits.js";
import configRoutes from "./routes/config.js";
import accountRoutes from "./routes/account.js";

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

// ─── Short URL redirect: /h/:hash ───────────────────────────────

app.get("/h/:hash", (c) => {
  const hash = c.req.param("hash");
  if (!/^[a-zA-Z0-9]{1,20}$/.test(hash)) {
    return c.text("Invalid link", 404);
  }
  const db = getDb();
  const link = db
    .prepare(
      "SELECT url, direct_redirect FROM links WHERE hash = ? AND is_public = 1",
    )
    .get(hash);

  if (!link) {
    return c.text("Link not found", 404);
  }

  // Direct redirect — go straight to the URL
  if (link.direct_redirect) {
    return c.redirect(link.url, 302);
  }

  // Otherwise show the view page
  return c.redirect(`${baseUrl("/public/view.html")}?hash=${hash}`);
});

// ─── Resolve project root (one level above backend/) ─────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

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

// Serve public assets (view.html, output.css, favicon.png)
app.use("/public/*", serveStatic({ root: projectRoot }));

// Serve favicon from root
app.use(
  "/favicon.png",
  serveStatic({ root: path.join(projectRoot, "public") }),
);

// ─── Root redirect ───────────────────────────────────────────────

app.get("/", (c) => c.redirect(baseUrl("/public/app/index.html")));

// ─── Old URL compat: redirect /public/index.html to Vue app ────

app.get("/public/index.html", (c) =>
  c.redirect(baseUrl("/public/app/index.html"), 301),
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
  });
}

export default app;
