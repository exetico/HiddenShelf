/**
 * Read later marks and counted opens (Shelf stats).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, createAuthenticatedUser, cleanup, json } from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Read later and opens", () => {
  let app, me;
  beforeEach(() => {
    app = createTestApp();
    me = createAuthenticatedUser("me@example.com");
  });
  afterEach(() => cleanup());

  const send = (method, url, cookie, body) =>
    app.request(url, {
      method,
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function addLink(cookie, extra = {}) {
    return (await json(await send("POST", "/api/links", cookie, { url: "https://example.com/a", title: "A", ...extra }))).link;
  }

  it("marks and unmarks a link to read later", async () => {
    const link = await addLink(me.cookie);
    expect(link.read_later).toBe(0);
    const on = await json(await send("PUT", `/api/links?id=${link.id}`, me.cookie, { read_later: true }));
    expect(on.link.read_later).toBe(1);
    // Other changes keep it
    const renamed = await json(await send("PUT", `/api/links?id=${link.id}`, me.cookie, { title: "B" }));
    expect(renamed.link.read_later).toBe(1);
    const off = await json(await send("PUT", `/api/links?id=${link.id}`, me.cookie, { read_later: false }));
    expect(off.link.read_later).toBe(0);
  });

  it("only takes true or false", async () => {
    const link = await addLink(me.cookie);
    const res = await send("PUT", `/api/links?id=${link.id}`, me.cookie, { read_later: "yes" });
    expect(res.status).toBe(400);
  });

  it("can save a new link as read later", async () => {
    expect((await addLink(me.cookie, { read_later: true })).read_later).toBe(1);
    expect((await addLink(me.cookie, { read_later: "1" })).read_later).toBe(0);
  });

  it("counts opens of own links only", async () => {
    const mine = await addLink(me.cookie);
    const other = createAuthenticatedUser("other@example.com");
    const theirs = await addLink(other.cookie);

    expect((await send("POST", `/api/links/opened?id=${mine.id}`, me.cookie)).status).toBe(200);
    await send("POST", `/api/links/opened?id=${mine.id}`, me.cookie);
    await send("POST", `/api/links/opened?id=${theirs.id}`, me.cookie);

    const db = getDb();
    const row = db.prepare("SELECT open_count, last_opened_at FROM links WHERE id = ?").get(mine.id);
    expect(row.open_count).toBe(2);
    expect(row.last_opened_at).toBeTruthy();
    expect(db.prepare("SELECT open_count FROM links WHERE id = ?").get(theirs.id).open_count).toBe(0);
  });

  it("needs a signed-in user and a link id", async () => {
    expect((await send("POST", "/api/links/opened?id=1", "")).status).toBe(401);
    expect((await send("POST", "/api/links/opened?id=x", me.cookie)).status).toBe(400);
  });

  it("hides the owner's marks and opens from people a category is shared with", async () => {
    const cat = (await json(await send("POST", "/api/categories", me.cookie, { name: "Recipes" }))).category;
    const link = await addLink(me.cookie, { category_id: cat.id, read_later: true });
    await send("POST", `/api/links/opened?id=${link.id}`, me.cookie);
    const share = (await json(await send("POST", "/api/category_shares", me.cookie, { category_id: cat.id }))).share;
    const friend = createAuthenticatedUser("friend@example.com");
    await send("POST", "/api/category_shares", friend.cookie, { share_code: share.share_code });

    const theirView = (await json(await send("GET", "/api/links", friend.cookie))).links;
    expect(theirView[0]).toMatchObject({ read_later: 0, open_count: 0, last_opened_at: null });
    const myView = (await json(await send("GET", "/api/links", me.cookie))).links;
    expect(myView[0]).toMatchObject({ read_later: 1, open_count: 1 });
  });
});
