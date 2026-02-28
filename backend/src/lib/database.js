/**
 * Database singleton — better-sqlite3 with auto-migration.
 * Reuses the exact same SQLite schema/migration files from the PHP era,
 * so upgrading from PHP → Node is seamless for existing databases.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import config from "../config.js";

let db = null;

/**
 * Open (or create) the SQLite database and run any pending migrations.
 * @param {string} [dbPath] Override path (useful for tests with ':memory:')
 * @returns {Database.Database}
 */
export function getDb(dbPath) {
  if (db) return db;
  return initDb(dbPath);
}

/**
 * Initialise a fresh connection — called once at startup.
 */
export function initDb(dbPath) {
  const resolvedPath = dbPath || config.dbPath;

  // Ensure directory exists for file-based databases
  if (resolvedPath !== ":memory:") {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = new Database(resolvedPath);

  // Performance / safety pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  return db;
}

/**
 * Close the current connection (used in tests for cleanup).
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run numbered SQL migration files from db/migrations/.
 * Keeps exact same `_meta` schema_version tracking as the PHP Database class.
 */
function runMigrations(database) {
  // Get current schema version
  let currentVersion = 0;
  try {
    const row = database
      .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
      .get();
    if (row) currentVersion = parseInt(row.value, 10);
  } catch {
    // _meta table doesn't exist yet — version 0
  }

  // Locate migration files
  const migrationsDir = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "db",
    "migrations",
  );
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    if (version <= currentVersion) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      database.exec(sql);
      database
        .prepare(
          "INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)",
        )
        .run(String(version));
      if (config.debugMode) {
        console.log(`[db] Applied migration: ${file}`);
      }
    } catch (err) {
      console.error(`[db] Migration failed (${file}):`, err.message);
    }
  }
}
