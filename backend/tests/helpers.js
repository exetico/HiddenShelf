/**
 * Backend test helper — sets up an in-memory database and creates the Hono app
 * with all middleware and routes wired up, without starting the HTTP server.
 */

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { initDb, getDb, closeDb } from "../src/lib/database.js";
import { sessionMiddleware, sessions } from "../src/middleware/session.js";
import { cors } from "hono/cors";
import { requireJsonBody } from "../src/middleware/requireJson.js";
import { allowedCorsOrigin } from "../src/lib/helpers.js";

// Routes
import authRoutes, { loginAttempts } from "../src/routes/auth.js";
import linksRoutes from "../src/routes/links.js";
import categoriesRoutes from "../src/routes/categories.js";
import tagsRoutes from "../src/routes/tags.js";
import sharesRoutes from "../src/routes/shares.js";
import settingsRoutes from "../src/routes/settings.js";
import linkVisitsRoutes from "../src/routes/linkVisits.js";
import configRoutes from "../src/routes/config.js";
import accountRoutes from "../src/routes/account.js";
import { publicLinkRoutes } from "../src/routes/publicLink.js";
import { appShellRoutes } from "../src/routes/appShell.js";

const linkTemplatePath = fileURLToPath(
  new URL("./fixtures/link.html", import.meta.url),
);
const appIndexPath = fileURLToPath(
  new URL("./fixtures/app-index.html", import.meta.url),
);

/**
 * Create a fresh test app with an in-memory database.
 */
export function createTestApp() {
  // Close any previous connection
  closeDb();
  sessions.clear();
  loginAttempts.clear();

  // Init in-memory DB
  initDb(":memory:");

  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: allowedCorsOrigin,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      credentials: true,
    }),
  );
  app.use("*", sessionMiddleware());
  app.use("/api/*", requireJsonBody());

  app.route("/api/auth", authRoutes);
  app.route("/api/links", linksRoutes);
  app.route("/api/categories", categoriesRoutes);
  app.route("/api/tags", tagsRoutes);
  app.route("/api/category_shares", sharesRoutes);
  app.route("/api/user_settings", settingsRoutes);
  app.route("/api/link_visits", linkVisitsRoutes);
  app.route("/api/config", configRoutes);
  app.route("/api/account", accountRoutes);
  app.route("/", publicLinkRoutes({ templatePath: linkTemplatePath }));
  app.route("/", appShellRoutes({ indexPath: appIndexPath }));

  return app;
}

/**
 * Create a user directly in the database and return an authenticated session cookie.
 */
export function createAuthenticatedUser(email = "test@example.com") {
  const db = getDb();
  const existingUser = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);
  let userId;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    const info = db.prepare("INSERT INTO users (email) VALUES (?)").run(email);
    userId = info.lastInsertRowid;
  }

  // Create a session manually
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, {
    data: { user_id: userId, user_email: email },
    expiresAt: Date.now() + 86400000,
  });

  return {
    userId,
    cookie: `hiddenshelf_session=${sessionId}`,
  };
}

/**
 * Helper to parse JSON from a Hono Response.
 */
export async function json(res) {
  return res.json();
}

/**
 * Cleanup — close database.
 */
export function cleanup() {
  closeDb();
  sessions.clear();
  loginAttempts.clear();
}
