/**
 * Clean app URLs: the server answers app routes with the Vue app's
 * index.html, and login redirects point at them instead of
 * /public/app/index.html#/route.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, cleanup } from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { APP_ROUTES } from "../src/routes/appShell.js";
import config from "../src/config.js";

describe("App shell routes", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    cleanup();
  });

  it.each(APP_ROUTES)("serves the app at %s", async (route) => {
    const res = await app.request(route);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain('<div id="app"></div>');
  });

  it("points the share preview image at SITE_URL, as crawlers need", async () => {
    const html = await (await app.request("/")).text();
    expect(html).toContain(`<meta property="og:image" content="${config.siteUrl}/og-image.png" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${config.siteUrl}/og-image.png" />`);
  });

  it("keeps query strings working, e.g. a share invite", async () => {
    const res = await app.request("/login?share=abc");
    expect(res.status).toBe(200);
  });

  it("leaves the API and unknown paths alone", async () => {
    expect((await app.request("/api/links")).status).toBe(401);
    expect((await app.request("/not-an-app-route")).status).toBe(404);
  });

  it("redirects a magic link login to /dashboard", async () => {
    const token = "shelltoken123";
    const expiresAt = new Date(Date.now() + 600000)
      .toISOString()
      .replace("T", " ")
      .replace("Z", "");
    getDb()
      .prepare(
        "INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)",
      )
      .run("shell@example.com", token, expiresAt);

    const res = await app.request(`/api/auth/verify?token=${token}`);
    expect(res.headers.get("location")).toBe(`${config.siteUrl}/dashboard`);
  });

  it("sends login errors to /login?error=", async () => {
    const res = await app.request("/api/auth/verify?token=nope");
    const location = res.headers.get("location");
    expect(location.startsWith(`${config.siteUrl}/login?error=`)).toBe(true);
    expect(location).not.toContain("index.html");
  });

  it("sends a denied Google login to /login?error=oauth_denied", async () => {
    const saved = [config.googleClientId, config.googleClientSecret];
    config.googleClientId = "id";
    config.googleClientSecret = "secret";
    try {
      const res = await app.request("/api/auth/google/callback?error=access_denied");
      expect(res.headers.get("location")).toBe(
        `${config.siteUrl}/login?error=oauth_denied`,
      );
    } finally {
      [config.googleClientId, config.googleClientSecret] = saved;
    }
  });
});
