/**
 * Deploy readiness tests — fixes made before the first production deploy.
 *
 * Covers:
 *   1. return_to can't turn the magic link into an open redirect
 *   2. Writes with a non-JSON body are refused (CSRF)
 *   3. Two users can use the same tag name
 *   4. Public link lookup doesn't expose the owner
 *   5. Sessions are stored in the database
 *   6. Per-address login rate limit
 *   7. Forwarding headers are only trusted from a proxy
 *   8. Localhost origins only allowed in development
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createAuthenticatedUser,
  json,
  cleanup,
} from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import {
  generateToken,
  getClientIp,
  safeReturnTo,
  isAllowedRedirectOrigin,
} from "../src/lib/helpers.js";
import config from "../src/config.js";

function insertToken(email) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 600000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
  getDb()
    .prepare(
      "INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)",
    )
    .run(email, token, expiresAt);
  return token;
}

function sessionCookie(res) {
  const header = res.headers.get("set-cookie") || "";
  const match = header.match(/hiddenshelf_session=([a-f0-9]+)/);
  return match ? `hiddenshelf_session=${match[1]}` : null;
}

describe("Deploy readiness", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });
  afterEach(cleanup);

  // ── 1. return_to ──

  describe("return_to after login", () => {
    it.each(["@evil.com", "//evil.com/", "/\\evil.com", "https://evil.com"])(
      "ignores %s",
      async (returnTo) => {
        const login = await app.request("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "victim@example.com",
            return_to: returnTo,
          }),
        });
        const cookie = sessionCookie(login);
        const token = insertToken("victim@example.com");

        const res = await app.request(`/api/auth/verify?token=${token}`, {
          headers: { Cookie: cookie },
        });
        const location = res.headers.get("location");
        expect(location.startsWith(`${config.siteUrl}/`)).toBe(true);
        expect(new URL(location).host).toBe(new URL(config.siteUrl).host);
        expect(location).toContain("#/dashboard");
      },
    );

    it("keeps app routes and site paths", () => {
      expect(safeReturnTo("#/edit")).toBe("#/edit");
      expect(safeReturnTo("/h/abc123")).toBe("/h/abc123");
      expect(safeReturnTo(null)).toBe("#/dashboard");
    });
  });

  // ── 2. CSRF ──

  describe("non-JSON bodies", () => {
    it("refuses a text/plain POST", async () => {
      const { cookie } = createAuthenticatedUser();
      const body = JSON.stringify({ url: "https://evil.com", title: "x" });
      const res = await app.request("/api/links", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": String(body.length),
          Cookie: cookie,
        },
        body,
      });
      expect(res.status).toBe(415);
      expect(getDb().prepare("SELECT COUNT(*) AS n FROM links").get().n).toBe(
        0,
      );
    });

    it("allows a bodiless POST such as logout", async () => {
      const { cookie } = createAuthenticatedUser();
      const res = await app.request("/api/auth/logout", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
    });
  });

  // ── 3. Tags ──

  it("lets two users create the same tag name", async () => {
    const a = createAuthenticatedUser("a@example.com");
    const b = createAuthenticatedUser("b@example.com");
    for (const user of [a, b]) {
      const res = await app.request("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: user.cookie },
        body: JSON.stringify({
          url: "https://example.com",
          title: "Example",
          tags: ["work"],
        }),
      });
      expect(res.status).toBe(200);
    }
    const tags = getDb().prepare("SELECT user_id FROM tags WHERE name = 'work'");
    expect(tags.all()).toHaveLength(2);
  });

  // ── 4. Public link ──

  it("doesn't expose the owner on a public link", async () => {
    const { cookie } = createAuthenticatedUser("owner@example.com");
    const created = await json(
      await app.request("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          url: "https://example.com",
          title: "Public",
          is_public: 1,
          tags: ["t"],
        }),
      }),
    );
    const data = await json(
      await app.request(`/api/links?hash=${created.link.hash}`),
    );
    expect(data.link.title).toBe("Public");
    expect(data.link.url).toBe("https://example.com");
    expect(data.link.tags).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("owner@example.com");
    expect(data.link.user_id).toBeUndefined();
  });

  // ── 5. Sessions ──

  it("stores the login session in the database", async () => {
    const token = insertToken("persist@example.com");
    const res = await app.request(`/api/auth/verify?token=${token}`);
    const cookie = sessionCookie(res);
    expect(cookie).not.toBeNull();

    const id = cookie.split("=")[1];
    const row = getDb().prepare("SELECT data FROM sessions WHERE id = ?").get(id);
    expect(JSON.parse(row.data).user_email).toBe("persist@example.com");

    const me = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);

    await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(
      getDb().prepare("SELECT id FROM sessions WHERE id = ?").get(id),
    ).toBeUndefined();
  });

  // ── 6. Per-address rate limit ──

  it("rate limits one address even across IPs", async () => {
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `10.1.0.${i + 1}`,
        },
        body: JSON.stringify({ email: "inbox@example.com" }),
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  // ── 7. Client IP ──

  describe("getClientIp", () => {
    const original = config.trustProxy;
    afterEach(() => {
      config.trustProxy = original;
    });

    function ctx(remoteAddress, headers = {}) {
      return {
        env: { incoming: { socket: { remoteAddress, remoteFamily: "IPv4" } } },
        req: { header: (name) => headers[name] },
      };
    }

    it("ignores X-Forwarded-For from a public address", () => {
      expect(getClientIp(ctx("203.0.113.9", { "x-forwarded-for": "1.1.1.1" }))).toBe(
        "203.0.113.9",
      );
    });

    it("trusts X-Forwarded-For from a proxy on a private network", () => {
      expect(getClientIp(ctx("172.18.0.2", { "x-forwarded-for": "1.1.1.1, 172.18.0.2" }))).toBe(
        "1.1.1.1",
      );
    });

    it("follows TRUST_PROXY when set", () => {
      config.trustProxy = "false";
      expect(getClientIp(ctx("172.18.0.2", { "x-forwarded-for": "1.1.1.1" }))).toBe(
        "172.18.0.2",
      );
      config.trustProxy = "true";
      expect(getClientIp(ctx("203.0.113.9", { "x-forwarded-for": "1.1.1.1" }))).toBe(
        "1.1.1.1",
      );
    });
  });

  // ── 8. Localhost origins ──

  describe("localhost origins", () => {
    const original = { siteUrl: config.siteUrl, debugMode: config.debugMode };
    afterEach(() => Object.assign(config, original));

    it("are allowed when running locally", () => {
      config.siteUrl = "http://localhost:3000";
      expect(isAllowedRedirectOrigin("http://localhost:5173")).toBe(true);
    });

    it("are refused in production", () => {
      config.siteUrl = "https://links.example.com";
      config.debugMode = false;
      expect(isAllowedRedirectOrigin("http://localhost:5173")).toBe(false);
      expect(isAllowedRedirectOrigin("https://links.example.com")).toBe(true);
    });
  });
});
