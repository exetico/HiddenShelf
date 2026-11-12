/**
 * Daily database backups, made by the app itself.
 *
 * Once a day the app writes a consistent copy of the database to
 * db/backups/daily-YYYY-MM-DD.sqlite (SQLite's online backup, so it is safe
 * while people use the app) and removes daily copies older than
 * BACKUP_KEEP_DAYS days. Only files named daily-*.sqlite are ever removed:
 * `make backup` copies and the updater's pre-update copies are left alone.
 */

import fs from "node:fs";
import path from "node:path";

const DAILY = /^daily-(\d{4}-\d{2}-\d{2})\.sqlite$/;

/** The file name for a given day, in UTC. */
export function dailyName(date = new Date()) {
  return `daily-${date.toISOString().slice(0, 10)}.sqlite`;
}

/** db/backups next to the database file. */
export function backupDir(dbPath) {
  return path.join(path.dirname(path.resolve(dbPath)), "backups");
}

/**
 * Make today's backup if it isn't there yet, then prune.
 * Returns { made: name | null, removed: [names] }.
 */
export async function runDailyBackup(db, { dbPath, keepDays, now = new Date() }) {
  if (!keepDays) return { made: null, removed: [] };
  const dir = backupDir(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const name = dailyName(now);
  const target = path.join(dir, name);
  let made = null;
  if (!fs.existsSync(target)) {
    // Write to a temporary name first, so a crash never leaves a half copy
    // under the real name (which would stop today's backup from being made)
    const tmp = `${target}.tmp`;
    fs.rmSync(tmp, { force: true });
    await db.backup(tmp);
    fs.renameSync(tmp, target);
    made = name;
  }
  return { made, removed: pruneDailyBackups(dir, keepDays, now) };
}

/** Remove daily copies more than keepDays days old. */
export function pruneDailyBackups(dir, keepDays, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - keepDays + 1);
  const oldest = cutoff.toISOString().slice(0, 10);
  const removed = [];
  for (const file of fs.readdirSync(dir)) {
    const match = DAILY.exec(file);
    if (match && match[1] < oldest) {
      fs.rmSync(path.join(dir, file), { force: true });
      removed.push(file);
    }
  }
  return removed.sort();
}

/** Back up now (if today's copy is missing) and check again every hour. */
export function startDailyBackups(db, { dbPath, keepDays }) {
  if (!keepDays) {
    console.log("[backup] Daily backups are off (BACKUP_KEEP_DAYS=0).");
    return;
  }
  const tick = () =>
    runDailyBackup(db, { dbPath, keepDays })
      .then(({ made }) => {
        if (made) console.log(`[backup] Wrote db/backups/${made}; keeping ${keepDays} days.`);
      })
      .catch((err) => console.error("[backup] Daily backup failed:", err.message));
  setTimeout(tick, 10_000).unref();
  setInterval(tick, 60 * 60 * 1000).unref();
}
