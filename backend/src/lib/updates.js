/**
 * In-app updates — the web app's half.
 *
 * The web app never builds or restarts anything. An admin's click records a
 * row in update_requests and creates an empty flag file, var/inbox/update or
 * var/inbox/rollback ("Check for updates" creates var/inbox/check, with no
 * row: it only looks at GitHub). The supervisor (src/supervisor.js, the container's main
 * process) sees the flag, does the work, and writes plain text status files
 * to var/status/, which are read here.
 * Those files are treated as untrusted text: size-capped, parsed as
 * key=value or tab-separated lines, and only shown as text.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import config from "../config.js";
import { getDb } from "./database.js";
import { sendNotice } from "./mailer.js";

const MAX_FILE = 64 * 1024;
const HEX40 = /^[0-9a-f]{40}$/;
const FINAL_STATES = new Set(["succeeded", "failed", "rolled_back"]);
// A request the updater hasn't picked up in this time is given up on
// (the updater itself refuses requests older than 10 minutes)
const PENDING_TIMEOUT = 15 * 60;
const MIN_GAP = 60;
// The updater checks hourly; three missed checks means it isn't running
const UPDATER_STALE_AFTER = 3 * 60 * 60;

const now = () => Math.floor(Date.now() / 1000);

function controlPath(...parts) {
  return path.resolve(config.updateControlDir, ...parts);
}

/** Updates are offered at all: at least one admin is configured. */
export function updatesEnabled() {
  return config.updateAdminEmails.length > 0;
}

/** Whether this user may update. Uses the stored email, not the session's. */
export function isUpdateAdmin(userId) {
  if (!updatesEnabled() || !userId) return false;
  const user = getDb().prepare("SELECT email FROM users WHERE id = ?").get(userId);
  return Boolean(user && config.updateAdminEmails.includes(String(user.email).toLowerCase()));
}

/** Signed in recently enough to update (login_at is set at each login). */
export function hasFreshLogin(session) {
  const loginAt = Number(session.get("login_at")) || 0;
  return Date.now() - loginAt <= config.updateReauthMinutes * 60 * 1000;
}

function readText(file) {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(MAX_FILE);
      const n = fs.readSync(fd, buf, 0, MAX_FILE, 0);
      return buf.subarray(0, n).toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

/** key=value lines → object (only the keys asked for). */
export function parseKv(text, keys) {
  const out = {};
  if (!text) return out;
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i);
    if (keys.includes(key)) out[key] = line.slice(i + 1).slice(0, 300);
  }
  return out;
}

const int = (v) => (/^\d+$/.test(v || "") ? Number(v) : null);
const commitOrNull = (v) => (HEX40.test(v || "") ? v : null);

/** Everything the updater last reported, cleaned up for the API. */
export function readStatus() {
  const check = parseKv(readText(controlPath("status", "check")), [
    "checked_at", "ok", "error", "branch", "target", "count", "migrations",
  ]);
  const current = parseKv(readText(controlPath("status", "current")), ["commit", "date", "subject"]);
  const job = parseKv(readText(controlPath("status", "job")), [
    "id", "action", "state", "step", "message", "from", "to", "started_at", "finished_at",
  ]);
  const rollback = parseKv(readText(controlPath("status", "rollback")), [
    "commit", "subject", "date", "db_restore", "updated_at",
  ]);
  const available = (readText(controlPath("status", "available")) || "")
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([c]) => HEX40.test(c))
    .slice(0, 50)
    .map(([c, d, s]) => ({ commit: c, date: int(d), subject: (s || "").slice(0, 300) }));
  const log = (readText(controlPath("status", "log")) || "").slice(-16000);

  const checkedAt = int(check.checked_at);
  return {
    updater_seen: checkedAt !== null,
    updater_stale: checkedAt === null || now() - checkedAt > UPDATER_STALE_AFTER,
    checked_at: checkedAt,
    check_ok: check.ok === "yes",
    check_error: check.error || "",
    branch: check.branch || "main",
    current: commitOrNull(current.commit)
      ? { commit: current.commit, date: int(current.date), subject: current.subject || "" }
      : null,
    available: {
      target: commitOrNull(check.target),
      count: int(check.count) || 0,
      migrations: check.migrations === "yes",
      commits: available,
    },
    job: /^[0-9a-f]{32}$/.test(job.id || "")
      ? {
          id: job.id,
          action: job.action === "rollback" ? "rollback" : "update",
          state: ["running", ...FINAL_STATES].includes(job.state) ? job.state : "failed",
          step: job.step || "",
          message: job.message || "",
          from: commitOrNull(job.from),
          to: commitOrNull(job.to),
          started_at: int(job.started_at),
          finished_at: int(job.finished_at),
        }
      : null,
    rollback: commitOrNull(rollback.commit)
      ? {
          commit: rollback.commit,
          subject: rollback.subject || "",
          date: int(rollback.date),
          restores_database: rollback.db_restore === "yes",
          updated_at: int(rollback.updated_at),
        }
      : null,
    log,
  };
}

function short(commit) {
  return commit ? commit.slice(0, 7) : "?";
}

/** Email every admin; failures are logged, never thrown. */
async function notifyAdmins(subject, text) {
  for (const to of config.updateAdminEmails) {
    try {
      await sendNotice(to, `${config.siteName}: ${subject}`, `${text}\n\n${config.siteUrl}`);
    } catch (err) {
      console.error("[updates] Could not email", to, err.message);
    }
  }
}

/**
 * Copy the updater's result onto the request it belongs to, give up on
 * requests nobody picked up, and tell the admins. Safe to call often.
 */
export function syncResults(status = readStatus()) {
  if (!updatesEnabled()) return;
  const db = getDb();
  const job = status.job;
  if (job && FINAL_STATES.has(job.state)) {
    // The run that handled a request: the newest waiting one of that kind,
    // made before the run started, unless this run was already recorded
    const seen = db.prepare("SELECT 1 FROM update_requests WHERE job_id = ?").get(job.id);
    const row = seen
      ? null
      : db.prepare(
          `SELECT id, action, email FROM update_requests
           WHERE result IS NULL AND action = ? AND created_at <= ?
           ORDER BY created_at DESC LIMIT 1`,
        ).get(job.action, (job.started_at || now()) + 5);
    if (row) {
      db.prepare("UPDATE update_requests SET result = ?, message = ?, finished_at = ?, job_id = ? WHERE id = ?")
        .run(job.state, job.message, job.finished_at || now(), job.id, row.id);
      const what = row.action === "rollback" ? "Rollback" : "Update";
      const outcome = { succeeded: "finished", failed: "failed", rolled_back: "failed and was rolled back" }[job.state];
      notifyAdmins(`${what} ${outcome}`, `${what} requested by ${row.email} ${outcome}.\n${job.message}`);
    }
  }
  if (!(job && job.state === "running")) {
    db.prepare(
      `UPDATE update_requests SET result = 'failed', message = ?, finished_at = ?
       WHERE result IS NULL AND created_at < ?`,
    ).run("The updater did not pick this up. Is it running?", now(), now() - PENDING_TIMEOUT);
  }
}

export function history(limit = 20) {
  return getDb()
    .prepare(
      `SELECT id, action, target_commit, email, created_at, result, message, finished_at
       FROM update_requests ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(limit);
}

export class UpdateError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

/**
 * Record a request and raise the updater's flag. Throws UpdateError.
 * Nothing from the admin goes to the updater: the flag is an empty file.
 * @param {{ action: "update"|"rollback", userId: number, ip: string }} opts
 */
export function requestUpdate({ action, userId, ip }) {
  const db = getDb();
  const status = readStatus();
  syncResults(status);

  if (!status.updater_seen) {
    throw new UpdateError("The updater hasn't started yet. Check that UPDATE_ADMIN_EMAILS is set and the app was restarted with make up.", 503);
  }
  if (status.job && status.job.state === "running") {
    throw new UpdateError("An update is already running.");
  }
  const pending = db.prepare("SELECT 1 FROM update_requests WHERE result IS NULL").get();
  if (pending) throw new UpdateError("An update is already waiting to start.");
  const last = db.prepare("SELECT MAX(created_at) AS t FROM update_requests").get();
  if (last.t && now() - last.t < MIN_GAP) {
    throw new UpdateError("Please wait a minute before trying again.", 429);
  }

  if (action === "update") {
    if (!status.check_ok) throw new UpdateError(status.check_error || "The server can't be updated from here right now.");
    if (!status.available.count) throw new UpdateError("You're already on the latest version.");
  } else if (!status.rollback) {
    throw new UpdateError("There is no previous version to go back to.");
  }

  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);
  const id = crypto.randomBytes(16).toString("hex");
  // Recorded for the audit log only; the updater decides what to install
  const shown = action === "update" ? status.available.target : status.rollback.commit;

  db.prepare(
    `INSERT INTO update_requests (id, action, target_commit, user_id, email, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, action, shown, userId, user.email, ip, now());

  try {
    // Empty, and created only if it isn't there yet
    fs.writeFileSync(controlPath("inbox", action), "", { flag: "wx", mode: 0o600 });
  } catch (err) {
    db.prepare("UPDATE update_requests SET result = 'failed', message = ?, finished_at = ? WHERE id = ?")
      .run("Could not reach the updater.", now(), id);
    if (err.code === "EEXIST") throw new UpdateError("An update is already waiting to start.");
    console.error("[updates] Could not raise the flag:", err.message);
    throw new UpdateError("Could not reach the updater.", 503);
  }

  const what = action === "rollback"
    ? `a rollback to ${short(shown)}`
    : `an update to ${short(shown)} (${status.available.count} change${status.available.count === 1 ? "" : "s"})`;
  notifyAdmins(
    action === "rollback" ? "Rollback started" : "Update started",
    `${user.email} started ${what} from ${ip}.\nIf this wasn't one of you, empty UPDATE_ADMIN_EMAILS and run make up.`,
  );
  return { id };
}

/**
 * Ask the updater to look for a new version now instead of at the next
 * hourly check. Only an empty flag file: nothing from the admin is passed on.
 * At most once a minute (the updater enforces this too). Throws UpdateError.
 */
export function requestCheck() {
  const status = readStatus();
  if (!status.updater_seen) {
    throw new UpdateError("The updater hasn't started yet. Check that UPDATE_ADMIN_EMAILS is set and the app was restarted with make up.", 503);
  }
  if (status.job && status.job.state === "running") {
    throw new UpdateError("An update is running. It checks again when it's done.");
  }
  if (status.checked_at && now() - status.checked_at < MIN_GAP) {
    throw new UpdateError("Checked less than a minute ago.", 429);
  }
  try {
    fs.writeFileSync(controlPath("inbox", "check"), "", { flag: "wx", mode: 0o600 });
  } catch (err) {
    // Already asked and not picked up yet: that check will do
    if (err.code !== "EEXIST") {
      console.error("[updates] Could not raise the check flag:", err.message);
      throw new UpdateError("Could not reach the updater.", 503);
    }
  }
  return { checked_at: status.checked_at };
}
