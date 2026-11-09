/**
 * Who may join — new accounts when sign-up isn't open to everyone.
 *
 * SIGNUP_MODE (config.signupMode):
 *   open      anyone who signs in gets an account (no list involved)
 *   approval  someone new signs in, then asks to join; an admin approves
 *             or denies. Emails an admin added ahead of time join at once.
 *   invite    only emails an admin added can join; nobody can ask
 *
 * The list lives in access_list (migration 015). Security notes:
 * - A request is only ever made for an email the person just proved they
 *   own (a used magic link or a verified Google address), held in their
 *   session as join_email. So nobody can ask in someone else's name, and the
 *   login form answers exactly as before: it never tells whether an
 *   address has an account or a request.
 * - A request sends no email to the requester. Admins get at most one short
 *   "someone is waiting" notice per NOTIFY_GAP, with no requester content.
 * - The requester's note is length-capped and only ever shown as text.
 */

import config from "../config.js";
import { getDb } from "./database.js";
import { baseUrl, MAX_LENGTHS } from "./helpers.js";
import { sendNotice } from "./mailer.js";
import { updatesEnabled } from "./updates.js";

/** Longest note a requester can add. */
export const MAX_NOTE = MAX_LENGTHS.joinNote;
/** Requests waiting at once; beyond this, new ones are refused for now. */
export const MAX_PENDING = 200;
/** Entries on the list in total (waiting, approved and denied). */
export const MAX_ENTRIES = 2000;
/** How long a proved email stays usable for asking, after signing in. */
export const JOIN_WINDOW_MS = 60 * 60 * 1000;
/** At most one "someone asked to join" email to admins in this time. */
export const NOTIFY_GAP_MS = 6 * 60 * 60 * 1000;

const now = () => Math.floor(Date.now() / 1000);
const norm = (email) => String(email || "").trim().toLowerCase();

/**
 * The mode in effect. Asking needs someone to say yes, so "approval" with
 * no admins configured (UPDATE_ADMIN_EMAILS) works like "invite".
 */
export function signupMode() {
  const mode = config.signupMode;
  if (mode === "approval" && !updatesEnabled()) return "invite";
  return mode === "open" || mode === "approval" ? mode : "invite";
}

/** The list entry for an email, or undefined. */
export function entryFor(email) {
  return getDb().prepare("SELECT * FROM access_list WHERE email = ?").get(norm(email));
}

/** May this (proved) email make a new account now? */
export function mayJoin(email) {
  if (signupMode() === "open") return true;
  // Admins can always make their account, or nobody could ever let anyone in
  if (config.updateAdminEmails.includes(norm(email))) return true;
  return entryFor(email)?.status === "approved";
}

/** The account exists now; its list entry has done its job. */
export function joined(email) {
  getDb().prepare("DELETE FROM access_list WHERE email = ?").run(norm(email));
}

/**
 * Remember, in the session, an email the visitor just proved they own but
 * that may not join yet. Only this lets them ask.
 */
export function rememberJoinEmail(session, email) {
  session.set("join_email", norm(email));
  session.set("join_at", Date.now());
}

/** The proved email from a recent sign-in, or null. */
export function joinEmailFrom(session) {
  const email = session.get("join_email");
  const at = Number(session.get("join_at")) || 0;
  if (!email || Date.now() - at > JOIN_WINDOW_MS) return null;
  return email;
}

export class AccessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

let lastNotice = 0;

/** Lets tests start without a recent notice. */
export function resetNoticeTimer() {
  lastNotice = 0;
}

function notifyAdmins() {
  if (Date.now() - lastNotice < NOTIFY_GAP_MS) return;
  lastNotice = Date.now();
  const site = config.siteName;
  const text = [
    `Someone asked to join ${site}.`,
    "",
    `See who is waiting, and approve or deny, on the Admin page:`,
    `${config.siteUrl}${baseUrl("/admin")}`,
    "",
    `You get at most one of these emails every ${NOTIFY_GAP_MS / 3_600_000} hours.`,
  ].join("\n");
  for (const admin of config.updateAdminEmails) {
    sendNotice(admin, `Someone asked to join ${site}`, text).catch((err) =>
      console.error("[access] Could not email an admin:", err.message),
    );
  }
}

/**
 * Ask to join, for a proved email. Asking again changes nothing (and
 * sends nothing). Returns the entry's status.
 */
export function askToJoin(email, note) {
  if (signupMode() !== "approval") {
    throw new AccessError("This server isn't taking requests to join.", 403);
  }
  const text = typeof note === "string" ? note.trim() : "";
  if (note != null && typeof note !== "string") throw new AccessError("The note must be text.");
  if (text.length > MAX_NOTE) {
    throw new AccessError(`The note is too long (at most ${MAX_NOTE} characters).`);
  }

  const existing = entryFor(email);
  if (existing) return existing.status;

  const db = getDb();
  const { pending, total } = db
    .prepare(
      "SELECT SUM(status = 'pending') AS pending, COUNT(*) AS total FROM access_list",
    )
    .get();
  if ((pending || 0) >= MAX_PENDING || total >= MAX_ENTRIES) {
    throw new AccessError(
      "This server has a lot of requests waiting right now. Please try again later.",
      503,
    );
  }

  db.prepare(
    "INSERT INTO access_list (email, status, note, created_at) VALUES (?, 'pending', ?, ?)",
  ).run(norm(email), text || null, now());
  notifyAdmins();
  return "pending";
}

// ─── Admin side ──────────────────────────────────────────────────

/** Every entry, waiting ones first, newest first within each. */
export function listEntries() {
  return getDb()
    .prepare(
      `SELECT id, email, status, note, created_at, decided_at, decided_by FROM access_list
       ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                created_at DESC, id DESC`,
    )
    .all();
}

function adminEmail(userId) {
  return getDb().prepare("SELECT email FROM users WHERE id = ?").get(userId)?.email || null;
}

function hasAccount(email) {
  return Boolean(
    getDb().prepare("SELECT 1 FROM users WHERE lower(email) = ?").get(norm(email)),
  );
}

function welcomeText() {
  const site = config.siteName;
  return [
    `Your request to join ${site} was approved.`,
    "",
    "Sign in with the same email address to start using it:",
    `${config.siteUrl}${baseUrl("/login")}`,
    "",
    "--",
    `${site}. This is an automatic message, so replies are not read.`,
  ].join("\n");
}

/**
 * Approve or deny an entry. Approving someone who asked emails them once
 * (an admin's action, so it can't be used to flood an inbox; approving an
 * approved entry again changes nothing).
 */
export function decide(id, status, adminUserId) {
  if (!["approved", "denied"].includes(status)) throw new AccessError("Unknown decision.");
  const db = getDb();
  const entry = db.prepare("SELECT * FROM access_list WHERE id = ?").get(id);
  if (!entry) throw new AccessError("That request is gone.", 404);
  if (entry.status === status) return entry;

  db.prepare(
    "UPDATE access_list SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?",
  ).run(status, now(), adminEmail(adminUserId), id);

  if (status === "approved") {
    sendNotice(entry.email, `You can now join ${config.siteName}`, welcomeText()).catch((err) =>
      console.error("[access] Could not send the approval email:", err.message),
    );
  }
  return db.prepare("SELECT * FROM access_list WHERE id = ?").get(id);
}

/**
 * Let an email in ahead of time. Sends nothing (the admin tells the person
 * themselves), unless it was a waiting request: then it's an approval.
 */
export function invite(email, adminUserId) {
  const address = norm(email);
  if (hasAccount(address)) throw new AccessError("That email already has an account.", 409);
  const existing = entryFor(address);
  if (existing) return decide(existing.id, "approved", adminUserId);
  const { total } = getDb().prepare("SELECT COUNT(*) AS total FROM access_list").get();
  if (total >= MAX_ENTRIES) throw new AccessError("The list is full. Remove some entries first.", 409);
  getDb()
    .prepare(
      "INSERT INTO access_list (email, status, created_at, decided_at, decided_by) VALUES (?, 'approved', ?, ?, ?)",
    )
    .run(address, now(), now(), adminEmail(adminUserId));
  return entryFor(address);
}

/** Remove an entry. A removed denied email can ask again. */
export function removeEntry(id) {
  const info = getDb().prepare("DELETE FROM access_list WHERE id = ?").run(id);
  if (!info.changes) throw new AccessError("That entry is gone.", 404);
}
