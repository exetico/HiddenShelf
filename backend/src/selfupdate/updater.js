/**
 * Self-update, Discourse style: the app container updates its own code.
 *
 * Run by the supervisor (src/supervisor.js), never by the web app. It takes
 * no input: an admin's click only creates an empty flag file, var/inbox/update
 * or var/inbox/rollback, which is never read, only checked for and deleted.
 * What to install is decided here, from the main branch of UPDATE_REPO_URL.
 *
 * Layout of var/ (a Docker volume, so updates survive a restart):
 *   repo.git/            bare clone used to fetch main and compare versions
 *   releases/<commit>/   a built copy of the app at that commit
 *   state/               current, previous (host of the rollback)
 *   status/              plain text files the app shows on the Update panel
 *   inbox/               the two flag files
 *
 * The image's own code (/app) is never changed. A release is used only while
 * it is newer than the image, so `make up` after a terminal upgrade wins.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const HEX40 = /^[0-9a-f]{40}$/;
const FLAG_MAX_AGE_MS = 10 * 60 * 1000;
const MIN_FREE_BYTES = 1024 * 1024 * 1024;
const KEEP_BACKUPS = 10;
const ACTIONS = ["update", "rollback"];

const clean = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 300);
const unix = () => Math.floor(Date.now() / 1000);

export function createUpdater({
  varDir,
  imageDir,
  imageCommit = "",
  repoUrl,
  branch = "main",
  dbPath,
  controller,
  healthTimeoutMs = 60_000,
  minFreeBytes = MIN_FREE_BYTES,
  env = process.env,
}) {
  if (!repoUrl) throw new Error("No repository to update from");
  const dirs = {
    repo: path.join(varDir, "repo.git"),
    releases: path.join(varDir, "releases"),
    state: path.join(varDir, "state"),
    status: path.join(varDir, "status"),
    inbox: path.join(varDir, "inbox"),
  };
  const logFile = path.join(dirs.state, "job.log");
  let job = null;

  // ─── Small helpers ─────────────────────────────────────────────

  function setup() {
    for (const d of Object.values(dirs)) {
      if (fs.existsSync(d) && fs.lstatSync(d).isSymbolicLink()) throw new Error(`${d} is a symlink`);
    }
    for (const d of [dirs.releases, dirs.state, dirs.status, dirs.inbox]) fs.mkdirSync(d, { recursive: true });
    if (!fs.existsSync(path.join(dirs.repo, "HEAD"))) {
      fs.mkdirSync(dirs.repo, { recursive: true });
      run("git", ["init", "--bare", "--quiet", dirs.repo]);
    }
  }

  function log(line) {
    fs.appendFileSync(logFile, `${new Date().toISOString().slice(11, 19)} ${line}\n`);
  }

  // Builds and git see only these variables: the app's secrets (SMTP,
  // Google) never reach npm install scripts
  const cmdEnv = { GIT_TERMINAL_PROMPT: "0" };
  for (const name of ["PATH", "HOME", "LANG", "TMPDIR", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS", "VITE_BASE_PATH"]) {
    if (env[name]) cmdEnv[name] = env[name];
  }

  // Commands get fixed argument lists, never a shell
  function run(cmd, args, { cwd, timeout = 20 * 60 * 1000 } = {}) {
    const res = spawnSync(cmd, args, {
      cwd,
      env: cmdEnv,
      encoding: "utf8",
      timeout,
      maxBuffer: 64 * 1024 * 1024,
    });
    // The log shows what builds print, and anything that failed
    if (job && (cmd === "npm" || res.status !== 0)) {
      const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
      if (out) fs.appendFileSync(logFile, out.split("\n").slice(-40).join("\n") + "\n");
    }
    if (res.status !== 0) {
      const err = new Error(`${cmd} ${args[0]} failed`);
      err.output = res.stderr;
      throw err;
    }
    return (res.stdout || "").trim();
  }

  const git = (...args) => run("git", ["--git-dir", dirs.repo, ...args]);
  const gitOk = (...args) => {
    try {
      git(...args);
      return true;
    } catch {
      return false;
    }
  };
  const hasCommit = (c) => HEX40.test(c || "") && gitOk("cat-file", "-e", `${c}^{commit}`);
  const isAncestor = (a, b) => gitOk("merge-base", "--is-ancestor", a, b);

  function publish(name, text) {
    const tmp = path.join(dirs.status, `.${name}.${process.pid}`);
    fs.writeFileSync(tmp, text, { mode: 0o644 });
    fs.renameSync(tmp, path.join(dirs.status, name));
  }
  const kv = (obj) => Object.entries(obj).map(([k, v]) => `${k}=${clean(v)}`).join("\n") + "\n";

  function readState(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dirs.state, name), "utf8"));
    } catch {
      return null;
    }
  }
  function writeState(name, value) {
    const file = path.join(dirs.state, name);
    if (value == null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, JSON.stringify(value));
  }

  function releaseDir(commit) {
    if (!commit || commit === imageCommit) return imageDir;
    const dir = path.join(dirs.releases, commit);
    return fs.existsSync(path.join(dir, ".ready")) ? dir : null;
  }

  function writeJob(state, step, message = "") {
    publish("job", kv({
      id: job.id, action: job.action, state, step, message,
      from: job.from || "", to: job.to || "",
      started_at: job.started, finished_at: state === "running" ? "" : unix(),
    }));
    const tail = fs.readFileSync(logFile, "utf8").split("\n").slice(-300).join("\n");
    publish("log", tail.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/:\/\/[^/@\s]+@/g, "://***@"));
  }
  function step(text) {
    log(`== ${text}`);
    writeJob("running", text);
  }
  class Stop extends Error {}
  const fail = (message) => {
    throw new Stop(message);
  };

  // ─── Which version runs ────────────────────────────────────────

  /** The commit running now: the current release, else the image. */
  function runningCommit() {
    const cur = readState("current");
    return cur && HEX40.test(cur.commit) ? cur.commit : imageCommit;
  }

  /**
   * At start: use the current release only while it is a newer version
   * of the image's code. Otherwise the image wins (e.g. after make upgrade).
   */
  function startupChoice() {
    const cur = readState("current");
    if (cur && HEX40.test(cur.commit) && cur.commit !== imageCommit) {
      const dir = releaseDir(cur.commit);
      const newer = !imageCommit || (hasCommit(imageCommit) && isAncestor(imageCommit, cur.commit));
      if (dir && newer) return { dir, commit: cur.commit };
    }
    if (cur) writeState("current", null);
    return { dir: imageDir, commit: imageCommit };
  }

  // ─── check ─────────────────────────────────────────────────────

  function fetchMain() {
    git("fetch", "--quiet", repoUrl, `+refs/heads/${branch}:refs/heads/${branch}`);
    return git("rev-parse", `refs/heads/${branch}`);
  }

  function writeCurrent() {
    const c = runningCommit();
    let line = "";
    if (hasCommit(c)) line = git("log", "-1", "--format=%ct%x09%s", c);
    const [date, subject] = line.split("\t");
    publish("current", HEX40.test(c || "") ? kv({ commit: c, date: date || "", subject: subject || "" }) : "");
  }

  function check() {
    const result = { ok: true, error: "", target: "", count: 0, migrations: false, list: "" };
    try {
      result.target = fetchMain();
    } catch {
      Object.assign(result, { ok: false, error: "Could not reach GitHub to check for updates." });
    }
    const running = runningCommit();
    if (result.ok) {
      if (!HEX40.test(running || "")) {
        Object.assign(result, { ok: false, error: "This image doesn't say which version it is. Run make up once from the terminal." });
      } else if (!hasCommit(running)) {
        Object.assign(result, { ok: false, error: `This server runs code that isn't on ${branch}. Update from the terminal.` });
      } else if (running !== result.target) {
        if (isAncestor(running, result.target)) {
          result.count = Number(git("rev-list", "--count", `${running}..${result.target}`));
          result.list = git("log", "-n", "50", "--format=%H%x09%ct%x09%s", `${running}..${result.target}`);
          result.migrations = git("diff", "--name-only", running, result.target, "--", "backend/migrations") !== "";
        } else {
          Object.assign(result, { ok: false, error: `This server runs code that isn't on ${branch}. Update from the terminal.` });
        }
      }
    }
    publish("available", result.list.split("\n").map(clean).filter(Boolean).join("\n") + "\n");
    publish("check", kv({
      checked_at: unix(), ok: result.ok ? "yes" : "no", error: result.error, branch,
      target: result.target, count: result.count, migrations: result.migrations ? "yes" : "no",
    }));
    writeCurrent();
    return result;
  }

  // ─── Building, backups ─────────────────────────────────────────

  function build(commit) {
    const dir = path.join(dirs.releases, commit);
    if (fs.existsSync(path.join(dir, ".ready"))) return dir;
    const tmp = path.join(dirs.releases, `.tmp-${commit}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(tmp);
    const tar = `${tmp}.tar`;
    git("archive", "--format=tar", "-o", tar, commit);
    run("tar", ["-xf", tar, "-C", tmp]);
    fs.rmSync(tar, { force: true });
    run("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: path.join(tmp, "backend") });
    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: path.join(tmp, "frontend") });
    run("npm", ["run", "build"], { cwd: path.join(tmp, "frontend") });
    fs.rmSync(path.join(tmp, "frontend", "node_modules"), { recursive: true, force: true });
    fs.writeFileSync(path.join(tmp, ".ready"), commit);
    fs.renameSync(tmp, dir);
    return dir;
  }

  async function backupDb(name) {
    const dir = path.join(path.dirname(dbPath), "backups");
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(dbPath, { fileMustExist: true });
    try {
      await db.backup(path.join(dir, name));
    } finally {
      db.close();
    }
    return name;
  }

  function restoreDb(name) {
    fs.copyFileSync(path.join(path.dirname(dbPath), "backups", name), dbPath);
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });
  }

  function pruneBackups() {
    const dir = path.join(path.dirname(dbPath), "backups");
    const files = fs.readdirSync(dir).filter((f) => /^pre-update-.*\.sqlite$/.test(f)).sort().reverse();
    for (const f of files.slice(KEEP_BACKUPS)) fs.rmSync(path.join(dir, f), { force: true });
  }

  function pruneReleases() {
    const keep = new Set([readState("current")?.commit, readState("previous")?.commit]);
    for (const name of fs.readdirSync(dirs.releases)) {
      if (!keep.has(name)) fs.rmSync(path.join(dirs.releases, name), { recursive: true, force: true });
    }
  }

  const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

  function setCurrent(commit) {
    writeState("current", commit && commit !== imageCommit ? { commit } : null);
  }

  // ─── update ────────────────────────────────────────────────────

  async function doUpdate() {
    step("Checking for the new version");
    const result = check();
    if (!result.ok) fail(result.error);
    if (!result.count) fail("Already up to date.");
    const old = runningCommit();
    const oldDir = releaseDir(old);
    if (!oldDir) fail("The running version's files are missing. Update from the terminal.");
    Object.assign(job, { from: old, to: result.target });
    const { bavail, bsize } = fs.statfsSync(varDir);
    if (bavail * bsize < minFreeBytes) fail("Less than 1 GB of disk space is free.");

    step("Building the new version (the site stays up)");
    let dir;
    try {
      dir = build(result.target);
    } catch {
      fs.rmSync(path.join(dirs.releases, `.tmp-${result.target}`), { recursive: true, force: true });
      fail("The build failed. Nothing was changed.");
    }

    step("Backing up the database");
    const backup = await backupDb(`pre-update-${stamp()}.sqlite`).catch(() => fail("The database backup failed. Nothing was changed."));

    step("Starting the new version");
    await controller.stop();
    await controller.start(dir, result.target);
    step("Checking the new version");
    if (await controller.healthy(healthTimeoutMs)) {
      writeState("previous", { commit: old, backup, db_restore: result.migrations });
      setCurrent(result.target);
      publish("rollback", kv({
        commit: old, subject: hasCommit(old) ? git("log", "-1", "--format=%s", old) : "",
        date: hasCommit(old) ? git("log", "-1", "--format=%ct", old) : "",
        db_restore: result.migrations ? "yes" : "no", updated_at: unix(),
      }));
      pruneReleases();
      pruneBackups();
      log("== Done");
      writeJob("succeeded", "Done", `Updated to ${result.target.slice(0, 7)}.`);
      check();
      return;
    }

    step("The new version did not start; rolling back");
    await controller.stop();
    restoreDb(backup);
    await controller.start(oldDir, old);
    const back = await controller.healthy(healthTimeoutMs);
    writeCurrent();
    writeJob(back ? "rolled_back" : "failed", back ? "Rolled back" : "Rollback failed", back
      ? "The new version did not pass its health check, so the previous version and its database were put back."
      : "The new version failed and so did the rollback. Check the logs (make logs).");
  }

  // ─── rollback ──────────────────────────────────────────────────

  async function doRollback() {
    step("Checking the previous version");
    const prev = readState("previous");
    if (!prev || !HEX40.test(prev.commit || "")) fail("There is no previous version to go back to.");
    if (prev.backup && !/^pre-update-[0-9-]+\.sqlite$/.test(prev.backup)) fail("The saved previous version looks wrong.");
    const prevDir = releaseDir(prev.commit);
    if (!prevDir) fail("The previous version's files are gone. Roll back from the terminal.");
    const cur = runningCommit();
    const curDir = releaseDir(cur);
    Object.assign(job, { from: cur, to: prev.commit });

    let safety = null;
    if (prev.db_restore) {
      step("Backing up the current database");
      safety = await backupDb(`pre-rollback-${stamp()}.sqlite`).catch(() => fail("The database backup failed. Nothing was changed."));
    }
    step("Starting the previous version");
    await controller.stop();
    if (prev.db_restore) restoreDb(prev.backup);
    await controller.start(prevDir, prev.commit);
    if (await controller.healthy(healthTimeoutMs)) {
      setCurrent(prev.commit);
      writeState("previous", null);
      publish("rollback", "");
      pruneReleases();
      log("== Done");
      writeJob("succeeded", "Done", `Back on ${prev.commit.slice(0, 7)}.`);
      check();
      return;
    }
    await controller.stop();
    if (safety) restoreDb(safety);
    await controller.start(curDir, cur);
    await controller.healthy(healthTimeoutMs);
    writeCurrent();
    writeJob("failed", "Rollback failed", "The previous version did not start, so the current one was started again.");
  }

  // ─── Requests ──────────────────────────────────────────────────

  /**
   * The flag the app left, if any. Its content is never read: only that it
   * exists (as anything at all) and how old it is. It is always deleted.
   */
  function takeFlag() {
    for (const action of ACTIONS) {
      const file = path.join(dirs.inbox, action);
      let st;
      try {
        st = fs.lstatSync(file);
      } catch {
        continue;
      }
      fs.rmSync(file, { force: true, recursive: true });
      if (Date.now() - st.mtimeMs > FLAG_MAX_AGE_MS) continue;
      return action;
    }
    return null;
  }

  /** A matching request the app recorded for an admin in the last 10 minutes. */
  function hasPendingRequest(action) {
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      try {
        return Boolean(db.prepare(
          "SELECT 1 FROM update_requests WHERE action = ? AND result IS NULL AND created_at > ?",
        ).get(action, unix() - FLAG_MAX_AGE_MS / 1000));
      } finally {
        db.close();
      }
    } catch {
      return false;
    }
  }

  /** Handle at most one flag. Returns the action handled, or null. */
  async function runPending() {
    const action = takeFlag();
    if (!action) return null;
    fs.writeFileSync(logFile, "");
    job = { id: crypto.randomBytes(16).toString("hex"), action, started: unix() };
    try {
      log(`Request: ${action}`);
      if (!hasPendingRequest(action)) fail("No matching request from an admin was found.");
      await (action === "update" ? doUpdate() : doRollback());
    } catch (err) {
      const message = err instanceof Stop ? err.message : "Something went wrong. Check the logs (make logs).";
      if (!(err instanceof Stop)) console.error("[updater]", err);
      log(`!! ${message}`);
      writeJob("failed", "Stopped", message);
    } finally {
      job = null;
    }
    return action;
  }

  /** Back to the image's code at the next start (the release kept crashing). */
  const forgetCurrent = () => writeState("current", null);

  return { setup, check, startupChoice, runPending, runningCommit, forgetCurrent, dirs };
}
