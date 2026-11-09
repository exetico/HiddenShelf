/**
 * Length and size limits on everything users can save.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createTestApp, createAuthenticatedUser, json, cleanup } from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { MAX_LENGTHS, MAX_BODY_BYTES, checkTagNames } from "../src/lib/helpers.js";

describe("Content limits", () => {
  let app;
  let cookie;

  beforeEach(() => {
    app = createTestApp();
    ({ cookie } = createAuthenticatedUser());
  });
  afterEach(cleanup);

  const send = (method, path, body) =>
    app.request(path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  const createLink = (fields) =>
    send("POST", "/api/links", { url: "https://example.com", title: "T", ...fields });

  it("saves a very long URL", async () => {
    const url = `https://example.com/?q=${"a".repeat(30000)}`;
    const res = await createLink({ url });
    expect(res.status).toBe(200);
    expect((await json(res)).link.url).toBe(url);
  });

  it("refuses a URL over the limit", async () => {
    const res = await createLink({ url: `https://example.com/?q=${"a".repeat(MAX_LENGTHS.url)}` });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/URL must not exceed/);
  });

  it("saves a long Markdown description and refuses one over the limit", async () => {
    const ok = await createLink({ description: "x".repeat(MAX_LENGTHS.description) });
    expect(ok.status).toBe(200);
    const tooLong = await createLink({ description: "x".repeat(MAX_LENGTHS.description + 1) });
    expect(tooLong.status).toBe(400);
    expect((await json(tooLong)).error).toMatch(/Description must not exceed/);
  });

  it("refuses a tag name over the limit, and saves nothing", async () => {
    const res = await createLink({ tags: ["ok", "t".repeat(MAX_LENGTHS.tagName + 1)] });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/too long/);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM links").get().n).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM tags").get().n).toBe(0);
  });

  it("refuses too many tags on one link", async () => {
    const tags = Array.from({ length: MAX_LENGTHS.tagsPerLink + 1 }, (_, i) => `t${i}`);
    const res = await createLink({ tags });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/at most 50 tags/);
  });

  it("refuses tags that aren't a list of names", async () => {
    for (const tags of ["abc", 5, [{ name: "x" }]]) {
      const res = await createLink({ tags });
      expect(res.status).toBe(400);
      expect((await json(res)).error).toBe("Tags must be a list of names");
    }
  });

  it("checks tags when a link is edited", async () => {
    const { link } = await json(await createLink({ tags: ["a"] }));
    const res = await send("PUT", `/api/links?id=${link.id}`, { tags: ["t".repeat(60)] });
    expect(res.status).toBe(400);
    const kept = getDb()
      .prepare("SELECT COUNT(*) AS n FROM link_tags WHERE link_id = ?")
      .get(link.id).n;
    expect(kept).toBe(1);
  });

  it("refuses a category icon or color over the limit", async () => {
    const icon = await send("POST", "/api/categories", { name: "A", icon: "i".repeat(101) });
    expect(icon.status).toBe(400);
    const color = await send("POST", "/api/categories", { name: "A", color: "c".repeat(33) });
    expect(color.status).toBe(400);
    const { category } = await json(await send("POST", "/api/categories", { name: "A" }));
    const edit = await send("PUT", `/api/categories?id=${category.id}`, { icon: "i".repeat(101) });
    expect(edit.status).toBe(400);
  });

  it("refuses a request body over the size limit with a clear message", async () => {
    const res = await createLink({ description: "x".repeat(MAX_BODY_BYTES) });
    expect(res.status).toBe(413);
    expect((await json(res)).error).toMatch(/too much to save at once/);
  });

  it("refuses an over-long email address at login", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${"a".repeat(260)}@example.com` }),
    });
    expect(res.status).toBe(400);
  });

  it("dedupes and trims tag names", () => {
    expect(checkTagNames([" a ", "a", "", "b"])).toEqual({ names: ["a", "b"] });
    expect(checkTagNames(undefined)).toEqual({ names: [] });
  });

  it("matches the limits the app checks before saving", () => {
    const source = readFileSync(new URL("../../frontend/src/lib/limits.js", import.meta.url), "utf8");
    for (const key of ["url", "title", "description", "icon", "categoryName", "tagName", "tagsPerLink"]) {
      const match = source.match(new RegExp(`\\b${key}: ([\\d_]+)`));
      expect(match, key).toBeTruthy();
      expect(Number(match[1].replace(/_/g, "")), key).toBe(MAX_LENGTHS[key]);
    }
  });
});
