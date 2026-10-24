/**
 * Tests for /api/auth endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { generateToken } from "../src/lib/helpers.js";

describe("Auth API", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    cleanup();
  });

  // ── POST /api/auth/login ──

  describe("POST /api/auth/login", () => {
    it("sends magic link for valid email", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      });
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.message).toContain("Magic link sent");
    });

    it("rejects invalid email", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "notanemail" }),
      });
      expect(res.status).toBe(400);
      const data = await json(res);
      expect(data.error).toBeDefined();
    });

    it("stores magic token in database", async () => {
      await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      });
      const db = getDb();
      const token = db
        .prepare("SELECT * FROM magic_tokens WHERE email = ?")
        .get("user@example.com");
      expect(token).toBeDefined();
      expect(token.used).toBe(0);
    });

    it("stores return_to in session", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          return_to: "#/edit",
        }),
      });
      expect(res.status).toBe(200);
    });
  });

  // ── GET /api/auth/verify ──

  describe("GET /api/auth/verify", () => {
    it("verifies valid token and redirects", async () => {
      const db = getDb();
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 600000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      db.prepare(
        "INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)",
      ).run("new@example.com", token, expiresAt);

      const res = await app.request(`/api/auth/verify?token=${token}`);
      expect(res.status).toBe(302);

      // Token should be marked as used
      const tokenRow = db
        .prepare("SELECT * FROM magic_tokens WHERE token = ?")
        .get(token);
      expect(tokenRow.used).toBe(1);

      // User should be created
      const user = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get("new@example.com");
      expect(user).toBeDefined();
    });

    it("rejects invalid token", async () => {
      const res = await app.request("/api/auth/verify?token=invalidtoken");
      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("error=");
    });

    it("rejects expired token", async () => {
      const db = getDb();
      const token = generateToken();
      const expiresAt = new Date(Date.now() - 60000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      db.prepare(
        "INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)",
      ).run("expired@example.com", token, expiresAt);

      const res = await app.request(`/api/auth/verify?token=${token}`);
      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("error=");
    });

    it("rejects already-used token", async () => {
      const db = getDb();
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 600000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      db.prepare(
        "INSERT INTO magic_tokens (email, token, expires_at, used) VALUES (?, ?, ?, 1)",
      ).run("used@example.com", token, expiresAt);

      const res = await app.request(`/api/auth/verify?token=${token}`);
      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("error=");
    });

    it("redirects with redirect_origin when provided", async () => {
      const db = getDb();
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 600000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      db.prepare(
        "INSERT INTO magic_tokens (email, token, expires_at, redirect_origin) VALUES (?, ?, ?, ?)",
      ).run("dev@example.com", token, expiresAt, "http://localhost:5173");

      const res = await app.request(`/api/auth/verify?token=${token}`);
      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("localhost:5173");
    });
  });

  // ── POST /api/auth/logout ──

  describe("POST /api/auth/logout", () => {
    it("logs out authenticated user", async () => {
      const { cookie } = createAuthenticatedUser();
      const res = await app.request("/api/auth/logout", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.success).toBe(true);
    });
  });

  // ── GET /api/auth/me ──

  describe("GET /api/auth/me", () => {
    it("returns current user when authenticated", async () => {
      const { cookie } = createAuthenticatedUser("me@example.com");
      const res = await app.request("/api/auth/me", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe("me@example.com");
    });

    it("returns 401 when not authenticated", async () => {
      const res = await app.request("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/auth/google ──

  describe("GET /api/auth/google", () => {
    it("returns error when Google OAuth is not configured", async () => {
      const res = await app.request("/api/auth/google");
      expect(res.status).toBe(500);
      const data = await json(res);
      expect(data.error).toContain("not configured");
    });
  });
});
