/**
 * Ask to join (SIGNUP_MODE approval / invite): who can make an account,
 * asking, the admin's list, and the ways it could be misused.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestApp, createAuthenticatedUser, json, cleanup } from "./helpers.js";
import { getDb } from "../src/lib/database.js";
import { sessions } from "../src/middleware/session.js";
import { generateToken } from "../src/lib/helpers.js";
import config, { signupModeFromEnv } from "../src/config.js";
import * as mailer from "../src/lib/mailer.js";
import { MAX_NOTE, MAX_PENDING, JOIN_WINDOW_MS, NOTIFY_GAP_MS, signupMode } from "../src/lib/access.js";
import { REQUEST_LIMIT } from "../src/routes/access.js";

const ORIGIN = new URL(config.siteUrl).origin;
const ADMIN = "admin@example.com";

let app;
let saved;
let notices;

beforeEach(() => {
  app = createTestApp();
  saved = { mode: config.signupMode, admins: config.updateAdminEmails, gid: config.googleClientId, gsecret: config.googleClientSecret };
  config.signupMode = "approval";
  config.updateAdminEmails = [ADMIN];
  notices = vi.spyOn(mailer, "sendNotice").mockResolvedValue(true);
});

afterEach(() => {
  config.signupMode = saved.mode;
  config.updateAdminEmails = saved.admins;
  config.googleClientId = saved.gid;
  config.googleClientSecret = saved.gsecret;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
});

/** Follow a magic link for `email`; returns the response and its cookie. */
async function signInWithLink(email) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 600000).toISOString().replace("T", " ").replace("Z", "");
  getDb().prepare("INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)").run(email, token, expiresAt);
  const res = await app.request(`/api/auth/verify?token=${token}`);
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  return { res, cookie };
}

async function signInWithGoogle(email, { verified = true } = {}) {
  config.googleClientId = "id";
  config.googleClientSecret = "secret";
  vi.stubGlobal("fetch", vi.fn(async (url) => ({
    json: async () =>
      String(url).includes("token")
        ? { access_token: "t" }
        : { id: `g-${email}`, email, verified_email: verified },
  })));
  const sessionId = generateToken(32);
  sessions.set(sessionId, { data: { oauth2state: "st" }, expiresAt: Date.now() + 60000 });
  const res = await app.request("/api/auth/google/callback?state=st&code=c", {
    headers: { Cookie: `hiddenshelf_session=${sessionId}` },
  });
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  return { res, cookie };
}

function me(cookie) {
  return app.request("/api/access/me", { headers: cookie ? { Cookie: cookie } : {} });
}

function ask(cookie, body = {}, ip = "198.51.100.1") {
  return app.request("/api/access/request", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function adminCall(cookie, method, path, body) {
  const headers = { Cookie: cookie, Origin: ORIGIN };
  if (body) headers["Content-Type"] = "application/json";
  return app.request(`/api/access/admin${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

const users = () => getDb().prepare("SELECT email FROM users").all().map((u) => u.email);
const entry = (email) => getDb().prepare("SELECT * FROM access_list WHERE email = ?").get(email);

describe("SIGNUP_MODE", () => {
  it("reads the mode, open by default and invite for typos", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(signupModeFromEnv(undefined)).toBe("open");
    expect(signupModeFromEnv("")).toBe("open");
    expect(signupModeFromEnv("Approval")).toBe("approval");
    expect(signupModeFromEnv("invite")).toBe("invite");
    expect(warn).not.toHaveBeenCalled();
    expect(signupModeFromEnv("opne")).toBe("invite");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("works like invite when there's no admin to approve", async () => {
    config.updateAdminEmails = [];
    expect(signupMode()).toBe("invite");
    const data = await json(await app.request("/api/config"));
    expect(data.signup_mode).toBe("invite");
  });

  it("open: anyone who signs in gets an account, as before", async () => {
    config.signupMode = "open";
    const { res } = await signInWithLink("new@example.com");
    expect(res.headers.get("location")).not.toContain("/join");
    expect(users()).toEqual(["new@example.com"]);
    expect((await json(await app.request("/api/config"))).signup_mode).toBe("open");
  });
});

describe("Signing in when sign-up isn't open", () => {
  it("sends someone new to the join page without making an account", async () => {
    const { res, cookie } = await signInWithLink("new@example.com");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/\/join$/);
    expect(users()).toEqual([]);

    const data = await json(await me(cookie));
    expect(data).toMatchObject({ mode: "approval", email: "new@example.com", status: "none", can_ask: true });
    // Not signed in
    expect((await app.request("/api/auth/me", { headers: { Cookie: cookie } })).status).toBe(401);
  });

  it("does the same for a verified Google account", async () => {
    const { res, cookie } = await signInWithGoogle("g@example.com");
    expect(res.headers.get("location")).toMatch(/\/join$/);
    expect(users()).toEqual([]);
    expect((await json(await me(cookie))).email).toBe("g@example.com");
  });

  it("never offers asking for an unverified Google address", async () => {
    const { res, cookie } = await signInWithGoogle("victim@example.com", { verified: false });
    expect(res.headers.get("location")).toContain("error=oauth_failed");
    expect((await json(await me(cookie))).email).toBeNull();
  });

  it("lets an admin make their account, so someone can let others in", async () => {
    for (const mode of ["approval", "invite"]) {
      config.signupMode = mode;
      getDb().prepare("DELETE FROM users").run();
      const { res } = await signInWithLink("Admin@Example.com");
      expect(res.headers.get("location"), mode).not.toContain("/join");
      expect(users()).toEqual(["Admin@Example.com"]);
    }
  });

  it("lets existing accounts sign in as always", async () => {
    getDb().prepare("INSERT INTO users (email) VALUES (?)").run("old@example.com");
    const { res } = await signInWithLink("old@example.com");
    expect(res.headers.get("location")).not.toContain("/join");
  });

  it("lets an invited email make its account, then drops it from the list", async () => {
    const admin = createAuthenticatedUser(ADMIN);
    await adminCall(admin.cookie, "POST", "/invite", { email: "Friend@Example.com" });
    const { res } = await signInWithLink("friend@example.com");
    expect(res.headers.get("location")).not.toContain("/join");
    expect(users()).toContain("friend@example.com");
    expect(entry("friend@example.com")).toBeUndefined();
  });

  it("lets an invited Google account in too", async () => {
    const admin = createAuthenticatedUser(ADMIN);
    await adminCall(admin.cookie, "POST", "/invite", { email: "g@example.com" });
    const { res } = await signInWithGoogle("g@example.com");
    expect(res.headers.get("location")).not.toContain("/join");
    expect(users()).toContain("g@example.com");
  });

  it("invite mode: someone new sees the join page but can't ask", async () => {
    config.signupMode = "invite";
    const { cookie } = await signInWithLink("new@example.com");
    expect(await json(await me(cookie))).toMatchObject({ mode: "invite", can_ask: false });
    const res = await ask(cookie);
    expect(res.status).toBe(403);
    expect(entry("new@example.com")).toBeUndefined();
  });

  it("the login form still answers the same for any address", async () => {
    getDb().prepare("INSERT INTO users (email) VALUES (?)").run("old@example.com");
    const answers = [];
    for (const email of ["old@example.com", "new@example.com"]) {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `203.0.113.${answers.length + 1}` },
        body: JSON.stringify({ email }),
      });
      answers.push([res.status, await res.text()]);
    }
    expect(answers[0]).toEqual(answers[1]);
  });
});

describe("Asking to join", () => {
  it("needs a sign-in first: nobody can ask in someone else's name", async () => {
    const res = await app.request("/api/access/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "victim@example.com", note: "hi" }),
    });
    expect(res.status).toBe(401);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM access_list").get().n).toBe(0);
  });

  it("ignores an email in the body and uses the proved one", async () => {
    const { cookie } = await signInWithLink("me@example.com");
    await ask(cookie, { email: "victim@example.com" });
    expect(entry("victim@example.com")).toBeUndefined();
    expect(entry("me@example.com").status).toBe("pending");
  });

  it("records the request with a trimmed note and tells the admins", async () => {
    const { cookie } = await signInWithLink("new@example.com");
    const res = await ask(cookie, { note: "  Hi, it's Sam from the book club.  " });
    expect(res.status).toBe(200);
    expect((await json(res)).status).toBe("pending");
    expect(entry("new@example.com").note).toBe("Hi, it's Sam from the book club.");
    expect(notices).toHaveBeenCalledOnce();
    const [to, subject, text] = notices.mock.calls[0];
    expect(to).toBe(ADMIN);
    expect(subject).toMatch(/asked to join/);
    // Nothing the requester wrote goes into the admin's email
    expect(text).not.toContain("Sam");
    expect(text).not.toContain("new@example.com");
    expect((await json(await me(cookie))).status).toBe("pending");
  });

  it("sends the requester nothing, so it can't flood an inbox", async () => {
    const { cookie } = await signInWithLink("new@example.com");
    await ask(cookie);
    expect(notices.mock.calls.map((call) => call[0])).not.toContain("new@example.com");
  });

  it("asking again changes nothing and sends nothing", async () => {
    const { cookie } = await signInWithLink("new@example.com");
    await ask(cookie, { note: "first" });
    const again = await ask(cookie, { note: "second" });
    expect((await json(again)).status).toBe("pending");
    expect(entry("new@example.com").note).toBe("first");
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM access_list").get().n).toBe(1);
    expect(notices).toHaveBeenCalledOnce();
  });

  it("emails admins at most once per gap, however many ask", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    for (let i = 0; i < 4; i++) {
      const { cookie } = await signInWithLink(`p${i}@example.com`);
      await ask(cookie, {}, `198.51.100.${i + 1}`);
    }
    expect(notices).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(NOTIFY_GAP_MS + 1000);
    const { cookie } = await signInWithLink("later@example.com");
    await ask(cookie, {}, "198.51.100.99");
    expect(notices).toHaveBeenCalledTimes(2);
  });

  it("refuses a note that's too long or isn't text", async () => {
    const { cookie } = await signInWithLink("new@example.com");
    const long = await ask(cookie, { note: "x".repeat(MAX_NOTE + 1) });
    expect(long.status).toBe(400);
    expect((await json(long)).error).toMatch(/too long/);
    expect((await ask(cookie, { note: { evil: true } })).status).toBe(400);
    expect(entry("new@example.com")).toBeUndefined();
    expect((await ask(cookie, { note: "x".repeat(MAX_NOTE) })).status).toBe(200);
  });

  it("stores a note with markup as plain text", async () => {
    const { cookie } = await signInWithLink("new@example.com");
    await ask(cookie, { note: "<img src=x onerror=alert(1)>" });
    const admin = createAuthenticatedUser(ADMIN);
    const list = await json(await adminCall(admin.cookie, "GET", ""));
    expect(list.entries[0].note).toBe("<img src=x onerror=alert(1)>");
  });

  it("stops working an hour after signing in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    const { cookie } = await signInWithLink("new@example.com");
    vi.advanceTimersByTime(JOIN_WINDOW_MS + 1000);
    expect((await ask(cookie)).status).toBe(401);
    expect((await json(await me(cookie))).email).toBeNull();
  });

  it("limits requests per IP", async () => {
    const statuses = [];
    for (let i = 0; i <= REQUEST_LIMIT.max; i++) {
      const { cookie } = await signInWithLink(`p${i}@example.com`);
      statuses.push((await ask(cookie, {}, "198.51.100.7")).status);
    }
    expect(statuses.slice(0, REQUEST_LIMIT.max).every((s) => s === 200)).toBe(true);
    const last = statuses.at(-1);
    expect(last).toBe(429);
  });

  it("stops taking requests when too many are waiting", async () => {
    const insert = getDb().prepare("INSERT INTO access_list (email, status, created_at) VALUES (?, 'pending', 0)");
    for (let i = 0; i < MAX_PENDING; i++) insert.run(`w${i}@example.com`);
    const { cookie } = await signInWithLink("new@example.com");
    const res = await ask(cookie);
    expect(res.status).toBe(503);
    expect(entry("new@example.com")).toBeUndefined();
  });

  it("a denied request can't be sent again", async () => {
    const { cookie } = await signInWithLink("new@example.com");
    await ask(cookie);
    const admin = createAuthenticatedUser(ADMIN);
    await adminCall(admin.cookie, "POST", `/${entry("new@example.com").id}/deny`);
    expect((await json(await me(cookie))).status).toBe("denied");
    expect((await json(await me(cookie))).can_ask).toBe(false);
    expect((await json(await ask(cookie))).status).toBe("denied");
    expect(entry("new@example.com").status).toBe("denied");
  });

  it("only ever shows the visitor their own status", async () => {
    getDb().prepare("INSERT INTO access_list (email, status, created_at) VALUES ('other@example.com', 'denied', 0)").run();
    const res = await app.request("/api/access/me?email=other@example.com");
    expect(await json(res)).toMatchObject({ email: null, status: null, can_ask: false });
  });
});

describe("Admin list", () => {
  let admin;
  beforeEach(() => {
    admin = createAuthenticatedUser(ADMIN);
  });

  it("is hidden from everyone else (404, as if it didn't exist)", async () => {
    const user = createAuthenticatedUser("someone@example.com");
    for (const [method, path] of [["GET", ""], ["POST", "/invite"], ["POST", "/1/approve"], ["DELETE", "/1"]]) {
      expect((await adminCall(user.cookie, method, path, method === "POST" ? { email: "x@example.com" } : undefined)).status).toBe(404);
    }
    expect((await app.request("/api/access/admin")).status).toBe(401);
  });

  it("refuses changes that don't come from the app itself", async () => {
    const res = await app.request("/api/access/admin/invite", {
      method: "POST",
      headers: { Cookie: admin.cookie, "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ email: "x@example.com" }),
    });
    expect(res.status).toBe(403);
    const noOrigin = await app.request("/api/access/admin/1/approve", { method: "POST", headers: { Cookie: admin.cookie } });
    expect(noOrigin.status).toBe(403);
    expect(entry("x@example.com")).toBeUndefined();
  });

  it("lists waiting requests first", async () => {
    await adminCall(admin.cookie, "POST", "/invite", { email: "invited@example.com" });
    const { cookie } = await signInWithLink("asker@example.com");
    await ask(cookie, { note: "hello" });
    const data = await json(await adminCall(admin.cookie, "GET", ""));
    expect(data.mode).toBe("approval");
    expect(data.entries.map((e) => [e.email, e.status])).toEqual([
      ["asker@example.com", "pending"],
      ["invited@example.com", "approved"],
    ]);
    expect(data.entries[1].decided_by).toBe(ADMIN);
  });

  it("approving lets the person in and emails them once", async () => {
    const { cookie } = await signInWithLink("asker@example.com");
    await ask(cookie);
    notices.mockClear();
    const id = entry("asker@example.com").id;
    const res = await adminCall(admin.cookie, "POST", `/${id}/approve`);
    expect((await json(res)).entry.status).toBe("approved");
    expect(notices).toHaveBeenCalledOnce();
    expect(notices.mock.calls[0][0]).toBe("asker@example.com");
    expect(notices.mock.calls[0][2]).toMatch(/\/login/);

    // Approving again sends nothing more
    await adminCall(admin.cookie, "POST", `/${id}/approve`);
    expect(notices).toHaveBeenCalledOnce();

    const { res: signIn } = await signInWithLink("asker@example.com");
    expect(signIn.headers.get("location")).not.toContain("/join");
    expect(users()).toContain("asker@example.com");
  });

  it("denying sends nothing and keeps them out", async () => {
    const { cookie } = await signInWithLink("asker@example.com");
    await ask(cookie);
    notices.mockClear();
    await adminCall(admin.cookie, "POST", `/${entry("asker@example.com").id}/deny`);
    expect(notices).not.toHaveBeenCalled();
    const { res } = await signInWithLink("asker@example.com");
    expect(res.headers.get("location")).toMatch(/\/join$/);
    expect(users()).not.toContain("asker@example.com");
  });

  it("removing a denied entry lets them ask again", async () => {
    const { cookie } = await signInWithLink("asker@example.com");
    await ask(cookie);
    const id = entry("asker@example.com").id;
    await adminCall(admin.cookie, "POST", `/${id}/deny`);
    expect((await adminCall(admin.cookie, "DELETE", `/${id}`)).status).toBe(200);
    expect((await json(await ask(cookie))).status).toBe("pending");
  });

  it("inviting checks the email and won't add an existing account", async () => {
    for (const email of ["", "not-an-email", `${"a".repeat(250)}@example.com`, 42]) {
      expect((await adminCall(admin.cookie, "POST", "/invite", { email })).status).toBe(400);
    }
    expect((await adminCall(admin.cookie, "POST", "/invite", { email: "ADMIN@example.com" })).status).toBe(409);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM access_list").get().n).toBe(0);
  });

  it("inviting sends no email, and twice is the same as once", async () => {
    await adminCall(admin.cookie, "POST", "/invite", { email: "a@example.com" });
    await adminCall(admin.cookie, "POST", "/invite", { email: "A@example.com" });
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM access_list").get().n).toBe(1);
    expect(notices).not.toHaveBeenCalled();
  });

  it("inviting someone who is waiting approves them", async () => {
    const { cookie } = await signInWithLink("asker@example.com");
    await ask(cookie);
    notices.mockClear();
    await adminCall(admin.cookie, "POST", "/invite", { email: "asker@example.com" });
    expect(entry("asker@example.com").status).toBe("approved");
    expect(notices).toHaveBeenCalledOnce();
  });

  it("answers 404 for unknown or odd ids", async () => {
    for (const id of ["999", "abc", "-1", "1.5"]) {
      expect((await adminCall(admin.cookie, "POST", `/${id}/approve`)).status).toBe(404);
      expect((await adminCall(admin.cookie, "DELETE", `/${id}`)).status).toBe(404);
    }
  });
});

describe("Approving after a denial", () => {
  it("emails the person, since they asked", async () => {
    const admin = createAuthenticatedUser(ADMIN);
    const { cookie } = await signInWithLink("asker@example.com");
    await ask(cookie);
    const id = entry("asker@example.com").id;
    await adminCall(admin.cookie, "POST", `/${id}/deny`);
    notices.mockClear();
    await adminCall(admin.cookie, "POST", `/${id}/approve`);
    expect(notices).toHaveBeenCalledOnce();
    expect(notices.mock.calls[0][0]).toBe("asker@example.com");
  });
});
