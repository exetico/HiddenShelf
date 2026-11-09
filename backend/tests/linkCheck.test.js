/**
 * Tests for the link checker (lib/linkCheck.js) and POST /api/links/check.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, createAuthenticatedUser, cleanup, json } from "./helpers.js";
import { checkUrl, describeStatus, isPrivateAddress, mapLimit } from "../src/lib/linkCheck.js";
import { CHECK_BATCH, CHECK_LIMIT, checkUsage } from "../src/routes/links.js";

// A fake site: maps "METHOD url" (or just url) to an answer or an error
function fakeSite(answers) {
  const calls = [];
  const request = async (url, method) => {
    calls.push(`${method} ${url.href}`);
    const answer = answers[`${method} ${url.href}`] ?? answers[url.href];
    if (!answer) throw Object.assign(new Error("no answer"), { code: "ECONNRESET" });
    if (answer.error) throw Object.assign(new Error(answer.error), { code: answer.error });
    return { status: answer.status, location: answer.location || null };
  };
  return { request, calls };
}

describe("isPrivateAddress", () => {
  it("blocks private, loopback, link-local and reserved addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "[::1]",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:192.168.0.1",
      "not-an-ip",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
  });

  it("lets public addresses through", () => {
    for (const ip of ["93.184.216.34", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("describeStatus", () => {
  it("says what a status code means", () => {
    expect(describeStatus(200).status).toBe("ok");
    expect(describeStatus(404).status).toBe("broken");
    expect(describeStatus(410).status).toBe("broken");
    expect(describeStatus(403).status).toBe("unsure");
    expect(describeStatus(503).status).toBe("unsure");
  });
});

describe("checkUrl", () => {
  it("finds a working page with one HEAD request", async () => {
    const site = fakeSite({ "https://example.com/": { status: 200 } });
    const result = await checkUrl("https://example.com/", site);
    expect(result).toMatchObject({ status: "ok", code: 200, final_url: null });
    expect(site.calls).toEqual(["HEAD https://example.com/"]);
  });

  it("asks with GET when a site doesn't answer HEAD", async () => {
    const site = fakeSite({
      "HEAD https://example.com/": { status: 405 },
      "GET https://example.com/": { status: 200 },
    });
    expect((await checkUrl("https://example.com/", site)).status).toBe("ok");
    expect(site.calls).toEqual(["HEAD https://example.com/", "GET https://example.com/"]);
  });

  it("reports a page that's gone", async () => {
    const site = fakeSite({ "https://example.com/old": { status: 404 } });
    expect(await checkUrl("https://example.com/old", site)).toMatchObject({
      status: "broken",
      code: 404,
    });
  });

  it("reports a site whose name no longer exists", async () => {
    const site = fakeSite({ "https://gone.example/": { error: "ENOTFOUND" } });
    expect((await checkUrl("https://gone.example/", site)).status).toBe("broken");
  });

  it("says a page moved for good, with the new address", async () => {
    const site = fakeSite({
      "http://example.com/a": { status: 301, location: "https://example.com/a" },
      "https://example.com/a": { status: 308, location: "/b" },
      "https://example.com/b": { status: 200 },
    });
    expect(await checkUrl("http://example.com/a", site)).toMatchObject({
      status: "moved",
      final_url: "https://example.com/b",
    });
  });

  it("doesn't call a temporary redirect a move", async () => {
    const site = fakeSite({
      "https://example.com/": { status: 302, location: "https://example.com/login" },
      "https://example.com/login": { status: 200 },
    });
    expect((await checkUrl("https://example.com/", site)).status).toBe("ok");
  });

  it("gives up after too many redirects", async () => {
    const site = fakeSite({ "https://example.com/": { status: 302, location: "/" } });
    expect((await checkUrl("https://example.com/", site)).reason).toBe("Too many redirects");
  });

  it("never connects to a private address, even after a redirect", async () => {
    const direct = fakeSite({});
    expect((await checkUrl("http://192.168.1.10:8123/", direct)).status).toBe("skipped");
    expect((await checkUrl("http://[::1]/", direct)).status).toBe("skipped");
    expect(direct.calls).toEqual([]);

    const redirect = fakeSite({
      "https://example.com/": { status: 301, location: "http://169.254.169.254/latest" },
    });
    expect((await checkUrl("https://example.com/", redirect)).status).toBe("skipped");
    expect(redirect.calls).toEqual(["HEAD https://example.com/"]);
  });

  it("skips what isn't a web address", async () => {
    const site = fakeSite({
      "https://example.com/": { status: 301, location: "ftp://example.com/file" },
    });
    expect((await checkUrl("https://example.com/", site)).status).toBe("skipped");
    expect((await checkUrl("mailto:me@example.com", site)).status).toBe("skipped");
  });

  it("refuses names that resolve to a private address (real lookup)", async () => {
    // localhost resolves to 127.0.0.1 / ::1, which the lookup guard refuses
    expect((await checkUrl("http://localhost:1/")).status).toBe("skipped");
  });
});

describe("mapLimit", () => {
  it("keeps the order and runs at most `limit` at once", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});

describe("POST /api/links/check", () => {
  let app, cookie, userId;

  beforeEach(() => {
    app = createTestApp();
    ({ cookie, userId } = createAuthenticatedUser());
  });
  afterEach(() => cleanup());

  async function createLink(url, who = cookie) {
    const res = await app.request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: who },
      body: JSON.stringify({ url, title: "A link" }),
    });
    return (await json(res)).link;
  }
  const check = (ids, who = cookie) =>
    app.request("/api/links/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(who ? { Cookie: who } : {}) },
      body: JSON.stringify({ ids }),
    });

  it("requires sign-in", async () => {
    expect((await check([1], null)).status).toBe(401);
  });

  it("wants a short list of ids", async () => {
    expect((await check([])).status).toBe(400);
    expect((await check(["x"])).status).toBe(400);
    const tooMany = Array.from({ length: CHECK_BATCH + 1 }, (_, i) => i + 1);
    expect((await check(tooMany)).status).toBe(400);
  });

  it("checks only your own links, and skips private addresses", async () => {
    const mine = await createLink("http://192.168.1.10:8123");
    const other = createAuthenticatedUser("other@example.com");
    const theirs = await createLink("http://10.0.0.1", other.cookie);

    const res = await check([mine.id, theirs.id]);
    expect(res.status).toBe(200);
    const { results } = await json(res);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: mine.id, status: "skipped" });
  });

  it("limits how many links one person checks an hour", async () => {
    const link = await createLink("http://127.0.0.1");
    checkUsage.set(userId, { count: CHECK_LIMIT, resetAt: Date.now() + 60_000 });
    const res = await check([link.id]);
    expect(res.status).toBe(429);
    expect((await json(res)).error).toMatch(/Try again in 1 minute/);
  });
});
