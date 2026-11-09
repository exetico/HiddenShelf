/**
 * Login link limits: how often a sign-in link can be requested, the
 * message people see when they ask too often, and that the answer never
 * reveals whether an address has an account.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestApp, createAuthenticatedUser, json, cleanup } from "./helpers.js";
import { LOGIN_LIMITS } from "../src/routes/auth.js";

function requestLink(app, email, ip = "198.51.100.1") {
  return app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email }),
  });
}

describe("Login link limits", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("allows one link a minute per address, with a friendly wait message", async () => {
    expect((await requestLink(app, "me@example.com")).status).toBe(200);

    const res = await requestLink(app, "ME@example.com", "198.51.100.2");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const data = await json(res);
    expect(data.success).toBe(false);
    expect(data.retry_after).toBe(60);
    expect(data.error).toMatch(/inbox and spam folder/);
    expect(data.error).toMatch(/in 1 minute\./);

    vi.advanceTimersByTime(30_000);
    const later = await json(await requestLink(app, "me@example.com"));
    expect(later.error).toMatch(/in 30 seconds\./);

    vi.advanceTimersByTime(30_000);
    expect((await requestLink(app, "me@example.com")).status).toBe(200);
  });

  it("allows at most 5 links an hour per address", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await requestLink(app, "me@example.com", `198.51.100.${i + 1}`)).status);
      vi.advanceTimersByTime(61_000);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(LOGIN_LIMITS.email.at(-1).max).toBe(5);
  });

  it("does not count refused requests against the address", async () => {
    await requestLink(app, "me@example.com");
    for (let i = 0; i < 5; i++) await requestLink(app, "me@example.com");
    vi.advanceTimersByTime(61_000);
    expect((await requestLink(app, "me@example.com")).status).toBe(200);
  });

  it("limits one IP trying many addresses", async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await requestLink(app, `user${i}@example.com`)).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    const res = await requestLink(app, "another@example.com");
    expect(res.status).toBe(429);
    expect((await json(res)).error).toMatch(/your network/);
  });

  it("can't dodge the IP limit with a made-up X-Forwarded-For", async () => {
    // Behind nginx: the visitor's own header first, the real address last
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      const res = await requestLink(
        app,
        `user${i}@example.com`,
        `203.0.113.${i + 1}, 198.51.100.9`,
      );
      statuses.push(res.status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("answers the same for an address with and without an account", async () => {
    createAuthenticatedUser("known@example.com");

    const known = await requestLink(app, "known@example.com", "198.51.100.3");
    const unknown = await requestLink(app, "nobody@example.com", "198.51.100.4");
    expect(known.status).toBe(unknown.status);
    expect(await json(known)).toEqual(await json(unknown));

    const knownAgain = await requestLink(app, "known@example.com", "198.51.100.3");
    const unknownAgain = await requestLink(app, "nobody@example.com", "198.51.100.4");
    expect(knownAgain.status).toBe(429);
    expect(await json(knownAgain)).toEqual(await json(unknownAgain));
  });
});
