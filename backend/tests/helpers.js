/**
 * Backend test helper — sets up an in-memory database and creates the Hono app
 * with all middleware and routes wired up, without starting the HTTP server.
 */

import crypto from "node:crypto";
import { Hono } from "hono";
import { initDb, getDb, closeDb } from "../src/lib/database.js";
import { sessionMiddleware, sessions } from "../src/middleware/session.js";
import { cors } from "hono/cors";

// Routes
import authRoutes from "../src/routes/auth.js";
import linksRoutes from "../src/routes/links.js";
import categoriesRoutes from "../src/routes/categories.js";
import tagsRoutes from "../src/routes/tags.js";
import sharesRoutes from "../src/routes/shares.js";
import settingsRoutes from "../src/routes/settings.js";
import linkVisitsRoutes from "../src/routes/linkVisits.js";
import configRoutes from "../src/routes/config.js";

/**
 * Create a fresh test app with an in-memory database.
 */
export function createTestApp() {
  // Close any previous connection
  closeDb();
  sessions.clear();

  // Init in-memory DB
  initDb(":memory:");

  const app = new Hono();

  app.use("*", cors({ origin: "*", credentials: true }));
  app.use("*", sessionMiddleware());

  app.route("/api/auth", authRoutes);
  app.route("/api/links", linksRoutes);
  app.route("/api/categories", categoriesRoutes);
  app.route("/api/tags", tagsRoutes);
  app.route("/api/category_shares", sharesRoutes);
  app.route("/api/user_settings", settingsRoutes);
  app.route("/api/link_visits", linkVisitsRoutes);
  app.route("/api/config", configRoutes);

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
}
