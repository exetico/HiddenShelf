/**
 * Share links that end: 7 days at most, one use or anyone for 7 days.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, createAuthenticatedUser, cleanup, json } from "./helpers.js";
import { getDb } from "../src/lib/database.js";

describe("Share link expiry and modes", () => {
  let app, owner;

  beforeEach(() => {
    app = createTestApp();
    owner = createAuthenticatedUser("owner@example.com");
  });
  afterEach(() => cleanup());

  const post = (cookie, body) =>
    app.request("/api/category_shares", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });

  function category() {
    return getDb()
      .prepare("INSERT INTO categories (user_id, name) VALUES (?, 'Recipes')")
      .run(owner.userId).lastInsertRowid;
  }

  const days = (iso) => (new Date(iso).getTime() - Date.now()) / 86_400_000;

  it("makes one-use links that end in 7 days by default", async () => {
    const data = await json(await post(owner.cookie, { category_id: category() }));
    expect(data.share.mode).toBe("once");
    expect(data.share.expired).toBe(false);
    expect(days(data.share.expires_at)).toBeGreaterThan(6.9);
    expect(days(data.share.expires_at)).toBeLessThanOrEqual(7);
  });

  it("treats an unknown mode as one use", async () => {
    const data = await json(await post(owner.cookie, { category_id: category(), mode: "forever" }));
    expect(data.share.mode).toBe("once");
  });

  it("lets several people join a 7-day link, and keeps the code", async () => {
    const catId = category();
    const { share } = await json(await post(owner.cookie, { category_id: catId, mode: "week" }));
    expect(share.mode).toBe("week");
    for (const email of ["a@example.com", "b@example.com"]) {
      const res = await post(createAuthenticatedUser(email).cookie, { share_code: share.share_code });
      expect(res.status).toBe(200);
    }
    const info = await json(
      await app.request(`/api/category_shares?category_id=${catId}`, { headers: { Cookie: owner.cookie } }),
    );
    expect(info.share.share_code).toBe(share.share_code);
    expect(info.members).toHaveLength(2);
  });

  it("replaces a one-use link when someone joins", async () => {
    const catId = category();
    const { share } = await json(await post(owner.cookie, { category_id: catId }));
    await post(createAuthenticatedUser("a@example.com").cookie, { share_code: share.share_code });
    const late = await post(createAuthenticatedUser("b@example.com").cookie, { share_code: share.share_code });
    expect(late.status).toBe(404);
  });

  it("refuses a link that has ended, and tells the owner", async () => {
    const catId = category();
    const { share } = await json(await post(owner.cookie, { category_id: catId, mode: "week" }));
    getDb().prepare("UPDATE category_shares SET expires_at = datetime('now', '-1 minute')").run();

    const verify = await app.request(`/api/category_shares?code=${share.share_code}`);
    expect(verify.status).toBe(404);
    expect((await json(verify)).error).toMatch(/ended/);
    const join = await post(createAuthenticatedUser("a@example.com").cookie, { share_code: share.share_code });
    expect(join.status).toBe(404);

    const info = await json(
      await app.request(`/api/category_shares?category_id=${catId}`, { headers: { Cookie: owner.cookie } }),
    );
    expect(info.share.expired).toBe(true);
  });

  it("refuses a code with no end date", async () => {
    const catId = category();
    const { share } = await json(await post(owner.cookie, { category_id: catId }));
    getDb().prepare("UPDATE category_shares SET expires_at = NULL").run();
    const join = await post(createAuthenticatedUser("a@example.com").cookie, { share_code: share.share_code });
    expect(join.status).toBe(404);
  });

  it("a new link restarts the 7 days and can switch the mode", async () => {
    const catId = category();
    await post(owner.cookie, { category_id: catId });
    getDb().prepare("UPDATE category_shares SET expires_at = datetime('now', '-1 day')").run();
    const { share } = await json(await post(owner.cookie, { category_id: catId, reset: true, mode: "week" }));
    expect(share.expired).toBe(false);
    expect(share.mode).toBe("week");
    // No mode keeps the current one
    const again = await json(await post(owner.cookie, { category_id: catId, reset: true }));
    expect(again.share.mode).toBe("week");
  });

  it("lists end dates on the owner's shared categories", async () => {
    const catId = category();
    await post(owner.cookie, { category_id: catId, mode: "week" });
    const data = await json(await app.request("/api/category_shares?owned=1", { headers: { Cookie: owner.cookie } }));
    expect(data.owned_shares[0]).toMatchObject({ mode: "week", expired: false });
    expect(data.owned_shares[0].single_use).toBeUndefined();
  });
});
