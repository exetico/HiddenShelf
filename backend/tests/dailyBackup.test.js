/**
 * Daily backups: one copy a day, old daily copies pruned, other backups kept.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { runDailyBackup, pruneDailyBackups, dailyName } from "../src/lib/dailyBackup.js";
import { backupKeepDaysFromEnv } from "../src/config.js";

describe("daily backups", () => {
  let dir;
  let dbPath;
  let db;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-backup-"));
    dbPath = path.join(dir, "database.sqlite");
    db = new Database(dbPath);
    db.exec("CREATE TABLE t (x TEXT); INSERT INTO t VALUES ('kept')");
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes a readable copy named after the day", async () => {
    const now = new Date("2026-11-12T08:00:00Z");
    const result = await runDailyBackup(db, { dbPath, keepDays: 30, now });
    expect(result.made).toBe("daily-2026-11-12.sqlite");
    const copy = new Database(path.join(dir, "backups", result.made), { readonly: true });
    expect(copy.prepare("SELECT x FROM t").get().x).toBe("kept");
    copy.close();
    expect(fs.existsSync(path.join(dir, "backups", `${result.made}.tmp`))).toBe(false);
  });

  it("makes only one copy a day", async () => {
    const now = new Date("2026-11-12T08:00:00Z");
    await runDailyBackup(db, { dbPath, keepDays: 30, now });
    const again = await runDailyBackup(db, { dbPath, keepDays: 30, now: new Date("2026-11-12T20:00:00Z") });
    expect(again.made).toBe(null);
  });

  it("keeps the last keepDays days of daily copies and nothing else is touched", () => {
    const backups = path.join(dir, "backups");
    fs.mkdirSync(backups);
    const names = [
      "daily-2026-10-13.sqlite", // 31 days before: removed
      "daily-2026-10-14.sqlite", // 30th day back: kept
      "daily-2026-11-12.sqlite",
      "hiddenshelf-20250101-000000.sqlite", // make backup
      "pre-update-2025-01-01.sqlite", // updater
      "daily-notes.txt",
    ];
    for (const n of names) fs.writeFileSync(path.join(backups, n), "x");
    const removed = pruneDailyBackups(backups, 30, new Date("2026-11-12T08:00:00Z"));
    expect(removed).toEqual(["daily-2026-10-13.sqlite"]);
    expect(fs.readdirSync(backups).sort()).toEqual(names.slice(1).sort());
  });

  it("does nothing when backups are off", async () => {
    const result = await runDailyBackup(db, { dbPath, keepDays: 0 });
    expect(result).toEqual({ made: null, removed: [] });
    expect(fs.existsSync(path.join(dir, "backups"))).toBe(false);
  });

  it("names days in UTC", () => {
    expect(dailyName(new Date("2026-01-02T23:59:59Z"))).toBe("daily-2026-01-02.sqlite");
  });
});

describe("BACKUP_KEEP_DAYS", () => {
  it("defaults to 30 and accepts 0 to turn backups off", () => {
    expect(backupKeepDaysFromEnv(undefined)).toBe(30);
    expect(backupKeepDaysFromEnv("")).toBe(30);
    expect(backupKeepDaysFromEnv("7")).toBe(7);
    expect(backupKeepDaysFromEnv("0")).toBe(0);
  });

  it("ignores values that aren't a number of days", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(backupKeepDaysFromEnv("-1")).toBe(30);
    expect(backupKeepDaysFromEnv("30 # a month")).toBe(30);
    expect(backupKeepDaysFromEnv("99999")).toBe(30);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
