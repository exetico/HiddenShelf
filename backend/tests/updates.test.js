/**
 * Tests for the in-app update endpoints (/api/updates) and /api/health.
 * The host updater's status files are written by hand into a temp folder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestApp, createAuthenticatedUser, cleanup, json } from "./helpers.js";
import config from "../src/config.js";
import { getDb } from "../src/lib/database.js";
import { parseKv, readStatus } from "../src/lib/updates.js";
import * as mailer from "../src/lib/mailer.js";

vi.mock("../src/lib/mailer.js", async (importOriginal) => ({
  ...(await importOriginal()),
  sendNotice: vi.fn(async () => true),
}));

const A = "a".repeat(40);
const B = "b".repeat(40);
const ORIGIN = new URL(config.siteUrl).origin;

describe("In-app updates", () => {
  let app, dir, admin, user;
  const saved = {};

  function writeStatus(name, text) {
    fs.writeFileSync(path.join(dir, "status", name), text);
  }

  function updaterReports({ count = 1, ok = "yes", target = B } = {}) {
    const now = Math.floor(Date.now() / 1000);
    writeStatus("check", `checked_at=${now}\nok=${ok}\nerror=\nbranch=main\ntarget=${target}\ncount=${count}\nmigrations=no\n`);
    writeStatus("current", `commit=${A}\ndate=${now - 100}\nsubject=First version\n`);
    writeStatus("available", `${B}\t${now}\tAdd a <b>table</b>\nnot a commit line\n`);
  }

  const post = (url, cookie, { body = {}, origin = ORIGIN } = {}) =>
    app.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(body),
    });

  const requestFile = () => path.join(dir, "inbox", "request");

  beforeEach(() => {
    saved.emails = config.updateAdminEmails;
    saved.dir = config.updateControlDir;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-updates-"));
    fs.mkdirSync(path.join(dir, "inbox"));
    fs.mkdirSync(path.join(dir, "status"));
    config.updateControlDir = dir;
    config.updateAdminEmails = ["admin@example.com"];
    mailer.sendNotice.mockClear();
    app = createTestApp();
    admin = createAuthenticatedUser("Admin@Example.com", { loginAt: Date.now() });
    user = createAuthenticatedUser("someone@example.com", { loginAt: Date.now() });
  });

  afterEach(() => {
    config.updateAdminEmails = saved.emails;
    config.updateControlDir = saved.dir;
    fs.rmSync(dir, { recursive: true, force: true });
    cleanup();
  });

  it("answers the health check", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
  });

  it("tells the app who may update", async () => {
    const me = async (cookie) => (await json(await app.request("/api/auth/me", { headers: { Cookie: cookie } }))).can_update;
    expect(await me(admin.cookie)).toBe(true);
    expect(await me(user.cookie)).toBe(false);
    config.updateAdminEmails = [];
    expect(await me(admin.cookie)).toBe(false);
  });

  it("hides the endpoints from everyone but admins", async () => {
    expect((await app.request("/api/updates")).status).toBe(401);
    expect((await app.request("/api/updates", { headers: { Cookie: user.cookie } })).status).toBe(404);
    expect((await post("/api/updates/update", user.cookie, { body: { commit: B } })).status).toBe(404);
    expect((await post("/api/updates/rollback", user.cookie)).status).toBe(404);
    config.updateAdminEmails = [];
    expect((await app.request("/api/updates", { headers: { Cookie: admin.cookie } })).status).toBe(404);
    expect(fs.existsSync(requestFile())).toBe(false);
  });

  it("shows the version and what an update brings in", async () => {
    updaterReports();
    const res = await app.request("/api/updates", { headers: { Cookie: admin.cookie } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.current).toMatchObject({ commit: A, subject: "First version" });
    expect(data.available).toMatchObject({ target: B, count: 1 });
    expect(data.available.commits).toEqual([expect.objectContaining({ commit: B, subject: "Add a <b>table</b>" })]);
    expect(data.updater_stale).toBe(false);
    expect(data.fresh_login).toBe(true);
  });

  it("starts an update: records it, drops only the id, emails the admins", async () => {
    updaterReports();
    const res = await post("/api/updates/update", admin.cookie, { body: { commit: B } });
    expect(res.status).toBe(202);
    const { id } = await json(res);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(fs.readFileSync(requestFile(), "utf8")).toBe(`${id}\n`);
    const row = getDb().prepare("SELECT * FROM update_requests WHERE id = ?").get(id);
    expect(row).toMatchObject({ action: "update", target_commit: B, email: "Admin@Example.com", result: null });
    expect(mailer.sendNotice).toHaveBeenCalledWith("admin@example.com", expect.stringContaining("Update started"), expect.any(String));
  });

  it("refuses a version other than the one the updater offers", async () => {
    updaterReports();
    const res = await post("/api/updates/update", admin.cookie, { body: { commit: A } });
    expect(res.status).toBe(409);
    expect((await post("/api/updates/update", admin.cookie, { body: { commit: "; rm -rf /" } })).status).toBe(400);
    expect(fs.existsSync(requestFile())).toBe(false);
  });

  it("needs a recent sign-in", async () => {
    updaterReports();
    const old = createAuthenticatedUser("admin@example.com", { loginAt: Date.now() - 11 * 60 * 1000 });
    const res = await post("/api/updates/update", old.cookie, { body: { commit: B } });
    expect(res.status).toBe(403);
    expect((await json(res)).reauth_required).toBe(true);
    const never = createAuthenticatedUser("admin@example.com");
    expect((await post("/api/updates/update", never.cookie, { body: { commit: B } })).status).toBe(403);
    expect(fs.existsSync(requestFile())).toBe(false);
  });

  it("refuses requests from another site or without an Origin", async () => {
    updaterReports();
    expect((await post("/api/updates/update", admin.cookie, { body: { commit: B }, origin: "https://evil.example" })).status).toBe(403);
    expect((await post("/api/updates/update", admin.cookie, { body: { commit: B }, origin: null })).status).toBe(403);
    expect(fs.existsSync(requestFile())).toBe(false);
  });

  it("says so when the updater isn't installed", async () => {
    const res = await post("/api/updates/update", admin.cookie, { body: { commit: B } });
    expect(res.status).toBe(503);
  });

  it("runs one update at a time", async () => {
    updaterReports();
    expect((await post("/api/updates/update", admin.cookie, { body: { commit: B } })).status).toBe(202);
    const again = await post("/api/updates/update", admin.cookie, { body: { commit: B } });
    expect(again.status).toBe(409);
  });

  it("records the updater's result and emails the admins", async () => {
    updaterReports();
    const { id } = await json(await post("/api/updates/update", admin.cookie, { body: { commit: B } }));
    writeStatus("job", `id=${id}\naction=update\nstate=rolled_back\nstep=Rolled back\nmessage=Health check failed\nfinished_at=1\n`);
    const data = await json(await app.request("/api/updates", { headers: { Cookie: admin.cookie } }));
    expect(data.job).toMatchObject({ id, state: "rolled_back" });
    expect(data.history[0]).toMatchObject({ id, result: "rolled_back", message: "Health check failed" });
    expect(mailer.sendNotice).toHaveBeenCalledWith("admin@example.com", expect.stringContaining("rolled back"), expect.any(String));
  });

  it("offers a rollback only when the updater kept a previous version", async () => {
    updaterReports();
    expect((await post("/api/updates/rollback", admin.cookie)).status).toBe(409);
    writeStatus("rollback", `commit=${A}\nsubject=First version\ndate=1\ndb_restore=yes\nupdated_at=2\n`);
    const res = await post("/api/updates/rollback", admin.cookie);
    expect(res.status).toBe(202);
    const row = getDb().prepare("SELECT action, target_commit FROM update_requests").get();
    expect(row).toEqual({ action: "rollback", target_commit: null });
  });

  it("reads status files defensively", () => {
    expect(parseKv("a=1\n=x\nb=2=3\nc=ignored\n", ["a", "b"])).toEqual({ a: "1", b: "2=3" });
    writeStatus("job", "id=../../etc\nstate=running\n");
    writeStatus("check", "checked_at=yesterday\ntarget=nope\n");
    const status = readStatus();
    expect(status.job).toBeNull();
    expect(status.updater_seen).toBe(false);
    expect(status.available.target).toBeNull();
  });
});
