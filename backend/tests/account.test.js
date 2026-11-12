/**
 * Account: delete the account for real, and sign out everywhere else.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, createAuthenticatedUser, json, cleanup } from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { sessions } from "../src/middleware/session.js";

function post(app, url, cookie, body) {
  return app.request(url, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

describe("Delete my account", () => {
  let app;
  beforeEach(() => {
    app = createTestApp();
  });
  afterEach(() => cleanup());

  async function fillShelf(cookie) {
    const cat = await json(await post(app, "/api/categories", cookie, { name: "Recipes" }));
    const categoryId = cat.category.id;
    await post(app, "/api/links", cookie, {
      url: "https://example.com/soup",
      title: "Soup",
      category_id: categoryId,
      tags: ["dinner"],
    });
    return categoryId;
  }

  it("refuses without the account's email", async () => {
    const { cookie, userId } = createAuthenticatedUser("me@example.com");
    for (const body of [{}, { email: "" }, { email: "other@example.com" }]) {
      const res = await post(app, "/api/account/delete", cookie, body);
      expect(res.status).toBe(400);
    }
    expect(getDb().prepare("SELECT id FROM users WHERE id = ?").get(userId)).toBeTruthy();
  });

  it("needs a signed-in user", async () => {
    const res = await post(app, "/api/account/delete", "", { email: "me@example.com" });
    expect(res.status).toBe(401);
  });

  it("removes the account, its data, its shares and every session", async () => {
    const db = getDb();
    const me = createAuthenticatedUser("Me@Example.com");
    const phone = createAuthenticatedUser("Me@Example.com"); // a second device
    const friend = createAuthenticatedUser("friend@example.com");

    // My category, shared with my friend
    const myCategory = await fillShelf(me.cookie);
    const share = await json(await post(app, "/api/category_shares", me.cookie, { category_id: myCategory }));
    await post(app, "/api/category_shares", friend.cookie, { share_code: share.share.share_code });

    // My friend's category, shared with me
    const theirCategory = await fillShelf(friend.cookie);
    const theirShare = await json(await post(app, "/api/category_shares", friend.cookie, { category_id: theirCategory }));
    await post(app, "/api/category_shares", me.cookie, { share_code: theirShare.share.share_code });

    db.prepare("INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))")
      .run("me@example.com", "unused-token");

    const res = await post(app, "/api/account/delete", me.cookie, { email: " me@example.com " });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);

    const id = me.userId;
    expect(db.prepare("SELECT COUNT(*) n FROM users WHERE id = ?").get(id).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM links WHERE user_id = ?").get(id).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM categories WHERE user_id = ?").get(id).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM tags WHERE user_id = ?").get(id).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM category_shares WHERE created_by = ?").get(id).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM category_share_members WHERE user_id = ?").get(id).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM category_share_members WHERE category_id = ?").get(myCategory).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM magic_tokens WHERE email = 'me@example.com'").get().n).toBe(0);

    // Both devices are signed out
    for (const cookie of [me.cookie, phone.cookie]) {
      const r = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
      expect(r.status).toBe(401);
    }

    // My friend keeps their own things
    const links = await json(await app.request("/api/links", { headers: { Cookie: friend.cookie } }));
    expect(links.links.map((l) => l.title)).toEqual(["Soup"]);
    expect(sessions.countForUser(friend.userId)).toBe(1);
  });
});

describe("Sign out everywhere else", () => {
  let app;
  beforeEach(() => {
    app = createTestApp();
  });
  afterEach(() => cleanup());

  it("counts and signs out the other devices, and keeps this one", async () => {
    const laptop = createAuthenticatedUser("me@example.com");
    const phone = createAuthenticatedUser("me@example.com");
    const tablet = createAuthenticatedUser("me@example.com");
    const someoneElse = createAuthenticatedUser("other@example.com");

    const before = await json(await app.request("/api/account/sessions", { headers: { Cookie: laptop.cookie } }));
    expect(before.other_sessions).toBe(2);

    const res = await app.request("/api/account/sessions", { method: "DELETE", headers: { Cookie: laptop.cookie } });
    expect(res.status).toBe(200);
    expect((await json(res)).signed_out).toBe(2);

    expect((await app.request("/api/auth/me", { headers: { Cookie: laptop.cookie } })).status).toBe(200);
    expect((await app.request("/api/auth/me", { headers: { Cookie: phone.cookie } })).status).toBe(401);
    expect((await app.request("/api/auth/me", { headers: { Cookie: tablet.cookie } })).status).toBe(401);
    expect((await app.request("/api/auth/me", { headers: { Cookie: someoneElse.cookie } })).status).toBe(200);

    const after = await json(await app.request("/api/account/sessions", { headers: { Cookie: laptop.cookie } }));
    expect(after.other_sessions).toBe(0);
  });

  it("needs a signed-in user", async () => {
    expect((await app.request("/api/account/sessions", { method: "DELETE" })).status).toBe(401);
  });
});
