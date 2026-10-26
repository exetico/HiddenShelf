/**
 * Tests for the public link page: /h/:hash and the old /public/view.html URL.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, createAuthenticatedUser, cleanup } from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { renderLinkPage, stripMarkdown } from "../src/routes/publicLink.js";

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
