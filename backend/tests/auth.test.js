/**
 * Tests for /api/auth endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sessions } from "../src/middleware/session.js";
import {
  createTestApp,
  createAuthenticatedUser,
  cleanup,
  json,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { generateToken } from "../src/lib/helpers.js";
import config from "../src/config.js";

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

    it("reports a fresh login once", async () => {
      const db = getDb();
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 600000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      db.prepare(
        "INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)",
      ).run("fresh@example.com", token, expiresAt);

      const verify = await app.request(`/api/auth/verify?token=${token}`);
      const cookie = verify.headers.get("set-cookie").split(";")[0];

      const first = await json(
        await app.request("/api/auth/me", { headers: { Cookie: cookie } }),
      );
      expect(first.welcome).toBe("new");

      const second = await json(
        await app.request("/api/auth/me", { headers: { Cookie: cookie } }),
      );
      expect(second.welcome).toBeNull();
    });

    it("returns 401 when not authenticated", async () => {
      const res = await app.request("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/auth/google/callback ──

  describe("GET /api/auth/google/callback", () => {
    const saved = {};
    beforeEach(() => {
      saved.id = config.googleClientId;
      saved.secret = config.googleClientSecret;
      config.googleClientId = "id";
      config.googleClientSecret = "secret";
    });
    afterEach(() => {
      config.googleClientId = saved.id;
      config.googleClientSecret = saved.secret;
      vi.unstubAllGlobals();
    });

    async function callback(googleUser) {
      vi.stubGlobal("fetch", vi.fn(async (url) => ({
        json: async () => (String(url).includes("token") ? { access_token: "t" } : googleUser),
      })));
      const sessionId = "s".repeat(64);
      sessions.set(sessionId, { data: { oauth2state: "st" }, expiresAt: Date.now() + 60000 });
      return app.request("/api/auth/google/callback?state=st&code=c", {
        headers: { Cookie: `hiddenshelf_session=${sessionId}` },
      });
    }

    it("refuses a Google account whose email isn't verified", async () => {
      const res = await callback({ id: "g1", email: "admin@example.com", verified_email: false });
      expect(res.headers.get("location")).toContain("error=oauth_failed");
      expect(getDb().prepare("SELECT COUNT(*) AS n FROM users").get().n).toBe(0);
    });

    it("signs in a verified Google account and records when", async () => {
      const res = await callback({ id: "g1", email: "new@example.com", verified_email: true });
      expect(res.headers.get("location")).not.toContain("error=");
      const row = getDb().prepare("SELECT data FROM sessions").all().map((r) => JSON.parse(r.data)).find((d) => d.user_id);
      expect(row.login_at).toBeGreaterThan(Date.now() - 5000);
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

// ── EMAIL_LOGIN_ENABLED=false ──

describe("Auth API with email login turned off", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    config.emailLoginEnabled = false;
  });

  afterEach(() => {
    config.emailLoginEnabled = true;
    cleanup();
  });

  it("refuses to send a magic link", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@example.com" }),
    });
    expect(res.status).toBe(403);
  });

  it("refuses an existing token", async () => {
    const res = await app.request("/api/auth/verify?token=abc");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=email_login_disabled");
  });

  it("tells the app in /api/config", async () => {
    const data = await json(await app.request("/api/config"));
    expect(data.email_login_enabled).toBe(false);
  });
});
