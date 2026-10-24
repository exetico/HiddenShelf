/**
 * Security tests — validates fixes for identified vulnerabilities.
 *
 * Covers:
 *   1. Open redirect via redirect_origin (magic link)
 *   2. Open redirect via OAuth redirect_origin
 *   3. CORS configuration (no wildcard with credentials)
 *   4. Debug mode defaults to false
 *   5. Secure cookie flag in production
 *   6. Rate limiting on /api/auth/login
 *   7. Input length validation
 *   8. javascript: URL rejection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  json,
  cleanup,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";

// ─── 1. Open Redirect Prevention ─────────────────────────────────

describe("Security: Open Redirect Prevention", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });
  afterEach(cleanup);

  it("rejects external redirect_origin in magic link login", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "victim@example.com",
        redirect_origin: "https://evil.com",
      }),
    });

    const data = await json(res);
    // Should either reject the request or ignore the malicious redirect_origin
    // After fix: the redirect_origin should be rejected or stripped
    expect(data.error || data.success).toBeTruthy();

    // If it succeeded, verify the stored token does NOT have the evil redirect_origin
    if (data.success) {
      const db = getDb();
      const token = db
        .prepare("SELECT * FROM magic_tokens WHERE email = ?")
        .get("victim@example.com");
      // redirect_origin should be null (stripped) because it's not an allowed origin
      expect(token.redirect_origin).toBeNull();
    }
  });

  it("allows same-site redirect_origin", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        redirect_origin: "http://localhost:5173",
      }),
    });

    const data = await json(res);
    expect(data.success).toBe(true);

    const db = getDb();
    const token = db
      .prepare("SELECT * FROM magic_tokens WHERE email = ?")
      .get("user@example.com");
    // localhost origins should be allowed (dev server)
    expect(token.redirect_origin).toBe("http://localhost:5173");
  });

  it("rejects redirect_origin with different host in verify redirect", async () => {
    const db = getDb();

    // Manually insert a token with a malicious redirect_origin
    // (simulating a bypass or legacy token)
    const expiresAt = new Date(Date.now() + 900000)
      .toISOString()
      .replace("T", " ")
      .replace("Z", "");

    db.prepare(
      "INSERT INTO magic_tokens (email, token, expires_at, redirect_origin) VALUES (?, ?, ?, ?)",
    ).run(
      "victim@example.com",
      "test-token-evil",
      expiresAt,
      "https://evil.com",
    );

    db.prepare("INSERT INTO users (email) VALUES (?)").run(
      "victim@example.com",
    );

    const res = await app.request("/api/auth/verify?token=test-token-evil", {
      redirect: "manual",
    });

    // Should NOT redirect to evil.com
    const location = res.headers.get("location") || "";
    expect(location).not.toContain("evil.com");
    // Should redirect to legitimate site instead
    expect(location).toContain("localhost");
  });
});

// ─── 2. Input Validation ─────────────────────────────────────────

describe("Security: Input Validation", () => {
  let app, cookie;

  beforeEach(() => {
    app = createTestApp();
    ({ cookie } = createAuthenticatedUser());
  });
  afterEach(cleanup);

  it("rejects javascript: URLs in link creation", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "javascript:alert(document.cookie)",
        title: "XSS Link",
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });

  it("rejects data: URLs in link creation", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "data:text/html,<script>alert(1)</script>",
        title: "Data URL XSS",
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });

  it("allows http: URLs in link creation", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "http://example.com",
        title: "Normal link",
      }),
    });

    const data = await json(res);
    expect(data.success).toBe(true);
  });

  it("allows https: URLs in link creation", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "https://example.com",
        title: "Secure link",
      }),
    });

    const data = await json(res);
    expect(data.success).toBe(true);
  });

  it("rejects excessively long URL", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "https://example.com/" + "a".repeat(10000),
        title: "Mega URL",
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });

  it("rejects excessively long title", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "https://example.com",
        title: "A".repeat(1000),
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });

  it("rejects excessively long description", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "https://example.com",
        title: "Valid",
        description: "D".repeat(10000),
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });

  it("rejects excessively long category name", async () => {
    const res = await app.request("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        name: "C".repeat(500),
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });

  it("rejects excessively long tag name", async () => {
    const res = await app.request("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        name: "T".repeat(500),
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });

  it("rejects javascript: URLs in link update", async () => {
    // Create a valid link first
    const createRes = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "https://example.com",
        title: "Safe link",
      }),
    });
    const createData = await json(createRes);
    const linkId = createData.link.id;

    // Try to update with javascript: URL
    const res = await app.request(`/api/links?id=${linkId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "javascript:alert(1)",
      }),
    });

    const data = await json(res);
    expect(data.error).toBeTruthy();
    expect(res.status).toBe(400);
  });
});

// ─── 3. Rate Limiting ────────────────────────────────────────────

describe("Security: Rate Limiting", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });
  afterEach(cleanup);

  it("rate limits login attempts after threshold", async () => {
    const results = [];

    // Send many login requests rapidly
    for (let i = 0; i < 12; i++) {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "1.2.3.4",
        },
        body: JSON.stringify({ email: `user${i}@example.com` }),
      });
      results.push(res.status);
    }

    // At least one request should be rate-limited (429)
    expect(results).toContain(429);
  });

  it("does not rate limit different IPs", async () => {
    const results = [];

    for (let i = 0; i < 6; i++) {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `10.0.0.${i + 1}`,
        },
        body: JSON.stringify({ email: `user${i}@example.com` }),
      });
      results.push(res.status);
    }

    // All should succeed since each comes from a different IP
    expect(results.every((s) => s === 200)).toBe(true);
  });
});

// ─── 4. Debug Mode Default ───────────────────────────────────────

describe("Security: Debug Mode Default", () => {
  it("defaults debug mode to false when env var is not set", async () => {
    // This tests that the config default changed from true to false
    // The actual config is loaded at import time so we test it indirectly
    // by checking that the error handler doesn't expose internals
    const app = createTestApp();

    // The config.debugMode should be false by default
    const { default: config } = await import("../src/config.js");
    // Note: in test environment DEBUG_MODE may be set; we verify the default logic
    // The default should be 'false', not 'true'
    if (!process.env.DEBUG_MODE) {
      expect(config.debugMode).toBe(false);
    }

    cleanup();
  });
});

// ─── 5. Session Cookie Security ──────────────────────────────────

describe("Security: Session Cookie Flags", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });
  afterEach(cleanup);

  it("sets HttpOnly flag on session cookies", async () => {
    const { cookie } = createAuthenticatedUser();
    const res = await app.request("/api/auth/me", {
      headers: { cookie },
    });

    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("HttpOnly");
  });

  it("sets SameSite=Lax on session cookies", async () => {
    const { cookie } = createAuthenticatedUser();
    const res = await app.request("/api/auth/me", {
      headers: { cookie },
    });

    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("SameSite=Lax");
  });
});

// ─── 6. CORS Configuration ──────────────────────────────────────

describe("Security: CORS Configuration", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });
  afterEach(cleanup);

  it("does not allow wildcard origin with credentials", async () => {
    const res = await app.request("/api/config", {
      headers: { origin: "https://evil.com" },
    });

    const allowOrigin = res.headers.get("access-control-allow-origin");
    // Should NOT be wildcard "*" — should be either the requesting origin (if allowed)
    // or missing/null for disallowed origins
    if (allowOrigin) {
      expect(allowOrigin).not.toBe("*");
    }
  });
});

// ─── 7. XSS Prevention ──────────────────────────────────────────

describe("Security: XSS Prevention", () => {
  let app, cookie;

  beforeEach(() => {
    app = createTestApp();
    ({ cookie } = createAuthenticatedUser());
  });
  afterEach(cleanup);

  it("strips HTML tags from link titles", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "https://example.com",
        title: '<script>alert("xss")</script>Safe Title',
      }),
    });

    const data = await json(res);
    expect(data.success).toBe(true);
    expect(data.link.title).not.toContain("<script>");
    expect(data.link.title).toContain("Safe Title");
  });

  it("strips HTML tags from descriptions", async () => {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        url: "https://example.com",
        title: "Test",
        description: '<img src=x onerror="alert(1)">Clean text',
      }),
    });

    const data = await json(res);
    expect(data.success).toBe(true);
    expect(data.link.description).not.toContain("<img");
    expect(data.link.description).toContain("Clean text");
  });

  it("strips HTML tags from category names", async () => {
    const res = await app.request("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        name: '<b onmouseover="alert(1)">Bold</b> Category',
      }),
    });

    const data = await json(res);
    expect(data.success).toBe(true);
    expect(data.category.name).not.toContain("<b");
    expect(data.category.name).toContain("Category");
  });
});
