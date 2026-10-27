/**
 * Tests for the public link page: /h/:hash and the old /public/view.html URL.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, createAuthenticatedUser, cleanup } from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { renderLinkPage, stripMarkdown } from "../src/routes/publicLink.js";
import config from "../src/config.js";

describe("Public link page", () => {
  let app, userId;

  beforeEach(() => {
    app = createTestApp();
    userId = createAuthenticatedUser().userId;
  });

  afterEach(() => {
    cleanup();
  });

  function createLink(hash, { isPublic = 1, directRedirect = 0, title = "Public Link", description = null } = {}) {
    getDb()
      .prepare(
        "INSERT INTO links (user_id, hash, url, title, description, is_public, direct_redirect) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(userId, hash, "https://example.com/page", title, description, isPublic, directRedirect);
  }

  function visitCount() {
    return getDb().prepare("SELECT COUNT(*) AS n FROM link_visits").get().n;
  }

  describe("GET /h/:hash", () => {
    it("serves the link page with the link's title and description", async () => {
      createLink("page1", { description: "A useful page" });
      const res = await app.request("/h/page1");
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("<title>Public Link — Hidden Shelf</title>");
      expect(html).toContain('data-link-meta="title" content="Public Link — Hidden Shelf"');
      expect(html).toContain('data-link-meta="description" content="A useful page"');
    });

    it("escapes HTML in the title", async () => {
      createLink("xss1", { title: '"><script>alert(1)</script>' });
      const html = await (await app.request("/h/xss1")).text();
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&quot;&gt;&lt;script&gt;");
    });

    it("redirects a direct-redirect link and counts the visit", async () => {
      createLink("direct1", { directRedirect: 1 });
      const res = await app.request("/h/direct1");
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://example.com/page");
      expect(visitCount()).toBe(1);
    });

    it("shows the page for a direct-redirect link with ?stay", async () => {
      createLink("direct2", { directRedirect: 1 });
      const res = await app.request("/h/direct2?stay");
      expect(res.status).toBe(200);
      // The page logs its own visit from the browser
      expect(visitCount()).toBe(0);
    });

    it("returns 404 for a private link", async () => {
      createLink("private1", { isPublic: 0 });
      const res = await app.request("/h/private1");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /h/:hash/embed", () => {
    it("serves a small card that other sites may frame", async () => {
      createLink("emb1", { title: "Grafana", description: "**Team** dashboards" });
      const res = await app.request("/h/emb1/embed");
      expect(res.status).toBe(200);
      const csp = res.headers.get("content-security-policy");
      expect(csp).toContain("frame-ancestors *");
      expect(csp).toContain("default-src 'none'");
      expect(res.headers.get("x-frame-options")).toBeNull();
      const html = await res.text();
      expect(html).toContain("<h1>Grafana</h1>");
      expect(html).toContain("<p>Team dashboards</p>");
      expect(html).toContain('<p class="host">example.com</p>');
      expect(html).toContain('href="/h/emb1" target="_blank"');
      expect(html).not.toContain("<script");
      // Showing the card isn't a visit; opening it is
      expect(visitCount()).toBe(0);
    });

    it("shows the card for direct-redirect links too", async () => {
      createLink("emb2", { directRedirect: 1 });
      expect((await app.request("/h/emb2/embed")).status).toBe(200);
    });

    it("escapes HTML", async () => {
      createLink("emb3", { title: '<img src=x onerror=alert(1)>' });
      const html = await (await app.request("/h/emb3/embed")).text();
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img src=x");
    });

    it("can fix the colors to light or dark", async () => {
      createLink("emb4");
      const auto = await (await app.request("/h/emb4/embed")).text();
      expect(auto).toContain("prefers-color-scheme:dark");
      const dark = await (await app.request("/h/emb4/embed?theme=dark")).text();
      expect(dark).not.toContain("prefers-color-scheme");
      expect(dark).toContain(":root{--bg:#232720");
    });

    it("returns 404 for private or deleted links", async () => {
      createLink("emb5", { isPublic: 0 });
      expect((await app.request("/h/emb5/embed")).status).toBe(404);
      createLink("emb6");
      getDb().prepare("UPDATE links SET deleted_at = CURRENT_TIMESTAMP WHERE hash = 'emb6'").run();
      expect((await app.request("/h/emb6/embed")).status).toBe(404);
      expect((await app.request("/h/bad!/embed")).status).toBe(404);
    });

    it("links back under BASE_PATH", async () => {
      createLink("emb7");
      const before = config.basePath;
      config.basePath = "/shelf";
      try {
        const html = await (await app.request("/h/emb7/embed")).text();
        expect(html).toContain('href="/shelf/h/emb7"');
      } finally {
        config.basePath = before;
      }
    });
  });

  describe("GET /public/view.html", () => {
    it("redirects the old URL to /h/:hash", async () => {
      const res = await app.request("/public/view.html?hash=abc123");
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe("/h/abc123");
    });

    it("keeps ?stay", async () => {
      const res = await app.request("/public/view.html?hash=abc123&stay");
      expect(res.headers.get("location")).toBe("/h/abc123?stay");
    });

    it("sends an invalid hash to the app", async () => {
      const res = await app.request("/public/view.html?hash=../x");
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
    });
  });

  describe("renderLinkPage", () => {
    it("gives share previews an absolute image, under BASE_PATH too", () => {
      const template = '<meta property="og:image" content="/shelf/og-image.png" />';
      const saved = { siteUrl: config.siteUrl, basePath: config.basePath };
      Object.assign(config, { siteUrl: "https://example.org", basePath: "/shelf" });
      try {
        const html = renderLinkPage(template, { title: "T", description: null });
        expect(html).toBe('<meta property="og:image" content="https://example.org/shelf/og-image.png" />');
      } finally {
        Object.assign(config, saved);
      }
    });

    it("uses a fallback description", () => {
      const html = renderLinkPage(
        '<meta data-link-meta="description" content="x" />',
        { title: "T", description: null },
      );
      expect(html).toContain('content="View &quot;T&quot; shared via Hidden Shelf"');
    });

    it("shows a Markdown description as plain text in previews", () => {
      const html = renderLinkPage(
        '<meta data-link-meta="description" content="x" />',
        { title: "T", description: "**Fast** [docs](https://x.com)\n- one\n- two" },
      );
      expect(html).toContain('content="Fast docs one two"');
    });
  });

  describe("stripMarkdown", () => {
    it("drops marks but keeps the words", () => {
      expect(stripMarkdown("_a_ `b` ~~c~~ # d")).toBe("a b c # d");
      expect(stripMarkdown("# Title\n1. x")).toBe("Title x");
    });
  });
});
