/**
 * Tests for the in-container self-updater (src/selfupdate/updater.js).
 *
 * Real git repositories in a temp folder stand in for GitHub; a fake npm on
 * PATH "installs" and "builds" instantly; the app process is a fake
 * controller whose health each test decides. The database is a real SQLite
 * file, so backups and restores are real.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createUpdater } from "../src/selfupdate/updater.js";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const hasGit = spawnSync("git", ["--version"]).status === 0 && spawnSync("tar", ["--version"]).status === 0;

const FAKE_NPM = `#!/bin/sh
[ -f "$(dirname "$0")/npm-fail" ] && exit 1
[ -n "$SMTP_PASS" ] && echo "leaked" > LEAKED
case "$1" in
  ci) mkdir -p node_modules ;;
  run) mkdir -p ../public/app && echo built > ../public/app/index.html ;;
esac
`;

describe.skipIf(!hasGit)("self-updater", () => {
  let dir, origin, work, varDir, imageDir, dbPath, env, controller, A, B;

  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  const git = (cwd, ...args) =>
    execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

  function commit(file, content, message) {
    fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    fs.writeFileSync(path.join(work, file), content);
    git(work, "add", "-A");
    git(work, "commit", "-q", "-m", message);
    git(work, "push", "-q", "origin", "HEAD:main");
    return git(work, "rev-parse", "HEAD");
  }

  function db() {
    return new Database(dbPath);
  }
  function request(action, ageSeconds = 0) {
    const d = db();
    d.prepare("INSERT INTO update_requests (action, created_at) VALUES (?, ?)").run(action, Math.floor(Date.now() / 1000) - ageSeconds);
    d.close();
    fs.writeFileSync(path.join(varDir, "inbox", action), "");
  }
  function notes() {
    const d = db();
    const rows = d.prepare("SELECT text FROM notes ORDER BY id").all().map((r) => r.text);
    d.close();
    return rows;
  }
  function kv(name) {
    const file = path.join(varDir, "status", name);
    if (!fs.existsSync(file)) return {};
    return Object.fromEntries(
      fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  }
  const state = (name) => {
    const f = path.join(varDir, "state", name);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  };

  function updater(opts = {}) {
    const u = createUpdater({
      varDir, imageDir, imageCommit: A, repoUrl: origin, dbPath, controller,
      healthTimeoutMs: 10, minFreeBytes: 1, env, ...opts,
    });
    u.setup();
    return u;
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-selfupdate-"));
    origin = path.join(dir, "origin.git");
    work = path.join(dir, "work");
    varDir = path.join(dir, "var");
    imageDir = path.join(dir, "image");
    git(dir, "init", "-q", "--bare", "-b", "main", origin);
    git(dir, "init", "-q", "-b", "main", work);
    git(work, "remote", "add", "origin", origin);
    fs.mkdirSync(path.join(work, "frontend"), { recursive: true });
    fs.writeFileSync(path.join(work, "frontend", "package.json"), "{}");
    A = commit("backend/migrations/001_initial.sql", "-- 1\n", "First version");
    B = commit("backend/migrations/002_more.sql", "-- 2\n", "Add a table");
    fs.mkdirSync(imageDir);

    fs.mkdirSync(path.join(dir, "db"));
    dbPath = path.join(dir, "db", "database.sqlite");
    const d = db();
    d.exec("CREATE TABLE update_requests (id INTEGER PRIMARY KEY, action TEXT, result TEXT, created_at INTEGER)");
    d.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)");
    d.prepare("INSERT INTO notes (text) VALUES (?)").run("original");
    d.close();

    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "npm"), FAKE_NPM, { mode: 0o755 });
    env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SMTP_PASS: "secret" };

    controller = {
      unhealthy: new Set(),
      starts: [],
      stops: 0,
      async start(codeDir, commit) {
        this.starts.push({ codeDir, commit });
        // A broken version that still writes to the database before dying
        if (this.unhealthy.has(commit)) {
          const d = db();
          d.prepare("INSERT INTO notes (text) VALUES (?)").run("written by broken version");
          d.close();
        }
      },
      async stop() {
        this.stops++;
      },
      async healthy() {
        return !this.unhealthy.has(this.starts.at(-1)?.commit);
      },
    };
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("lists what an update would bring in", () => {
    updater().check();
    expect(kv("check")).toMatchObject({ ok: "yes", target: B, count: "1", migrations: "yes" });
    expect(fs.readFileSync(path.join(varDir, "status", "available"), "utf8")).toContain("Add a table");
    expect(kv("current")).toMatchObject({ commit: A, subject: "First version" });
  });

  it("checks again when asked, but at most once a minute", async () => {
    const u = updater();
    u.check();
    const C = commit("README.md", "hi\n", "Docs");
    fs.writeFileSync(path.join(varDir, "inbox", "check"), "");
    expect(await u.runPending()).toBe("check");
    // Too soon after the last check: the flag is dropped, nothing fetched
    expect(kv("check").target).toBe(B);
    expect(fs.existsSync(path.join(varDir, "inbox", "check"))).toBe(false);
    const later = updater();
    fs.writeFileSync(path.join(varDir, "inbox", "check"), "");
    expect(await later.runPending()).toBe("check");
    expect(kv("check")).toMatchObject({ target: C, count: "2" });
    // A check never starts an update or touches the last run's log
    expect(controller.starts).toEqual([]);
    expect(kv("job")).toEqual({});
  });

  it("builds, backs up, switches and remembers the way back", async () => {
    const u = updater();
    request("update");
    expect(await u.runPending()).toBe("update");
    expect(kv("job")).toMatchObject({ action: "update", state: "succeeded", from: A, to: B });
    const release = path.join(varDir, "releases", B);
    expect(fs.readFileSync(path.join(release, "public/app/index.html"), "utf8")).toContain("built");
    expect(fs.existsSync(path.join(release, "frontend/node_modules"))).toBe(false);
    expect(controller.starts.at(-1)).toEqual({ codeDir: release, commit: B });
    expect(state("current")).toEqual({ commit: B });
    expect(state("previous")).toMatchObject({ commit: A, db_restore: true });
    expect(fs.readdirSync(path.join(dir, "db/backups"))[0]).toMatch(/^pre-update-.*\.sqlite$/);
    expect(kv("rollback")).toMatchObject({ commit: A, db_restore: "yes" });
    expect(kv("check").count).toBe("0");
    expect(fs.existsSync(path.join(varDir, "inbox", "update"))).toBe(false);
    // The app's secrets are not passed to the build
    expect(fs.existsSync(path.join(release, "backend", "LEAKED"))).toBe(false);
    expect(fs.existsSync(path.join(release, "frontend", "LEAKED"))).toBe(false);
  });

  it("does nothing without a matching request from an admin", async () => {
    const u = updater();
    fs.writeFileSync(path.join(varDir, "inbox", "update"), "");
    await u.runPending();
    expect(kv("job").message).toContain("No matching request");
    expect(controller.starts).toEqual([]);
    expect(fs.existsSync(path.join(varDir, "releases", B))).toBe(false);
  });

  it("never reads the flag: links, pipes and folders are just removed", async () => {
    const u = updater();
    const secret = path.join(dir, "secret");
    fs.writeFileSync(secret, "keep me");
    fs.symlinkSync(secret, path.join(varDir, "inbox", "rollback"));
    expect(await u.runPending()).toBe("rollback");
    expect(fs.readFileSync(secret, "utf8")).toBe("keep me");
    execFileSync("mkfifo", [path.join(varDir, "inbox", "update")]);
    expect(await u.runPending()).toBe("update");
    fs.mkdirSync(path.join(varDir, "inbox", "update"));
    expect(await u.runPending()).toBe("update");
    expect(fs.readdirSync(path.join(varDir, "inbox"))).toEqual([]);
    expect(controller.starts).toEqual([]);
  });

  it("ignores a flag that is older than ten minutes", async () => {
    const u = updater();
    request("update");
    const old = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(path.join(varDir, "inbox", "update"), old, old);
    expect(await u.runPending()).toBeNull();
    expect(fs.existsSync(path.join(varDir, "inbox", "update"))).toBe(false);
  });

  it("changes nothing when the build fails", async () => {
    fs.writeFileSync(path.join(dir, "bin", "npm-fail"), "");
    const u = updater();
    request("update");
    await u.runPending();
    expect(kv("job")).toMatchObject({ state: "failed" });
    expect(kv("job").message).toContain("build failed");
    expect(controller.stops).toBe(0);
    expect(state("current")).toBeNull();
    expect(fs.readdirSync(path.join(varDir, "releases"))).toEqual([]);
  });

  it("rolls back by itself, database included, when the new version is unhealthy", async () => {
    controller.unhealthy.add(B);
    const u = updater();
    request("update");
    await u.runPending();
    expect(kv("job").state).toBe("rolled_back");
    expect(controller.starts.at(-1)).toEqual({ codeDir: imageDir, commit: A });
    expect(notes()).toEqual(["original"]);
    expect(state("current")).toBeNull();
  });

  it("goes back one version when an admin asks", async () => {
    const u = updater();
    request("update");
    await u.runPending();
    const d = db();
    d.prepare("UPDATE update_requests SET result = 'succeeded'").run();
    d.prepare("INSERT INTO notes (text) VALUES (?)").run("saved after the update");
    d.close();
    request("rollback");
    await u.runPending();
    expect(kv("job")).toMatchObject({ action: "rollback", state: "succeeded", to: A });
    expect(controller.starts.at(-1)).toEqual({ codeDir: imageDir, commit: A });
    expect(state("current")).toBeNull();
    expect(state("previous")).toBeNull();
    // The update added a migration, so the database went back too, after a copy
    expect(notes()).toEqual(["original"]);
    expect(fs.readdirSync(path.join(dir, "db/backups")).some((f) => f.startsWith("pre-rollback-"))).toBe(true);
    expect(kv("rollback")).toEqual({});
  });

  it("starts the newest of the image and the last update", async () => {
    const u = updater();
    request("update");
    await u.runPending();
    // After a restart with the same image: the update is kept
    expect(updater().startupChoice()).toEqual({ dir: path.join(varDir, "releases", B), commit: B });
    // After make upgrade built an image that is as new or newer: the image wins
    expect(updater({ imageCommit: B }).startupChoice()).toEqual({ dir: imageDir, commit: B });
    expect(state("current")).toBeNull();
  });

  it("won't update a server running code that isn't on main", () => {
    updater({ imageCommit: "f".repeat(40) }).check();
    expect(kv("check")).toMatchObject({ ok: "no" });
    expect(kv("check").error).toContain("isn't on main");
  });
});
