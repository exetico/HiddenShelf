/**
 * Migration Tests
 *
 * Ensures all database migrations can be applied successfully on a fresh database.
 * These tests catch migration errors BEFORE spinning up the app in production.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Database Migrations", () => {
  let db;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    if (db) db.close();
  });

  /**
   * Helper: Run migrations from db/migrations/
   */
  function runMigrations(database, upToVersion = null) {
    const migrationsDir = path.resolve(
      __dirname,
      "..",
      "..",
      "db",
      "migrations",
    );
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Get current schema version
    let currentVersion = getSchemaVersion(database);

    for (const file of files) {
      const match = file.match(/^(\d+)_/);
      if (!match) continue;

      const version = parseInt(match[1], 10);

      // Skip already-applied migrations
      if (version <= currentVersion) continue;

      // If upToVersion is set, only run migrations up to that version
      if (upToVersion !== null && version > upToVersion) break;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      database.exec(sql);
      database
        .prepare(
          "INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)",
        )
        .run(String(version));
    }
  }

  /**
   * Helper: Get current schema version
   */
  function getSchemaVersion(database) {
    try {
      const row = database
        .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
        .get();
      return row ? parseInt(row.value, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: Check if table exists
   */
  function tableExists(database, tableName) {
    const row = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName);
    return !!row;
  }

  /**
   * Helper: Check if column exists in table
   */
  function columnExists(database, tableName, columnName) {
    const columns = database.pragma(`table_info(${tableName})`);
    return columns.some((col) => col.name === columnName);
  }

  it("runs all migrations successfully on a fresh database", () => {
    runMigrations(db);

    // Check final schema version
    const version = getSchemaVersion(db);
    expect(version).toBe(7); // Update this when adding new migrations

    // Verify all tables exist
    expect(tableExists(db, "_meta")).toBe(true);
    expect(tableExists(db, "users")).toBe(true);
    expect(tableExists(db, "magic_tokens")).toBe(true);
    expect(tableExists(db, "links")).toBe(true);
    expect(tableExists(db, "categories")).toBe(true);
    expect(tableExists(db, "tags")).toBe(true);
    expect(tableExists(db, "link_tags")).toBe(true);
    expect(tableExists(db, "category_shares")).toBe(true);
    expect(tableExists(db, "category_share_members")).toBe(true);
    expect(tableExists(db, "link_visits")).toBe(true);
    expect(tableExists(db, "user_settings")).toBe(true);
  });

  it("is idempotent (running migrations twice doesn't break)", () => {
    runMigrations(db);
    const version1 = getSchemaVersion(db);

    // Run migrations again
    runMigrations(db);
    const version2 = getSchemaVersion(db);

    expect(version1).toBe(version2);
    expect(version2).toBe(7);
  });

  describe("Migration 001: Initial Schema", () => {
    it("creates users, magic_tokens, links tables", () => {
      runMigrations(db, 1);

      expect(getSchemaVersion(db)).toBe(1);
      expect(tableExists(db, "_meta")).toBe(true);
      expect(tableExists(db, "users")).toBe(true);
      expect(tableExists(db, "magic_tokens")).toBe(true);
      expect(tableExists(db, "links")).toBe(true);
    });
  });

  describe("Migration 002: Categories", () => {
    it("creates categories table", () => {
      runMigrations(db, 2);

      expect(getSchemaVersion(db)).toBe(2);
      expect(tableExists(db, "categories")).toBe(true);
      expect(columnExists(db, "links", "category_id")).toBe(true);
    });
  });

  describe("Migration 003: Tags", () => {
    it("creates tags and link_tags tables", () => {
      runMigrations(db, 3);

      expect(getSchemaVersion(db)).toBe(3);
      expect(tableExists(db, "tags")).toBe(true);
      expect(tableExists(db, "link_tags")).toBe(true);
    });
  });

  describe("Migration 004: Direct Redirect", () => {
    it("adds direct_redirect and direct_redirect_default columns", () => {
      runMigrations(db, 4);

      expect(getSchemaVersion(db)).toBe(4);
      expect(columnExists(db, "links", "direct_redirect")).toBe(true);
      expect(columnExists(db, "categories", "direct_redirect_default")).toBe(
        true,
      );
    });
  });

  describe("Migration 005: Category Sharing and Visits", () => {
    it("creates category_shares, category_share_members, link_visits tables", () => {
      runMigrations(db, 5);

      expect(getSchemaVersion(db)).toBe(5);
      expect(tableExists(db, "category_shares")).toBe(true);
      expect(tableExists(db, "category_share_members")).toBe(true);
      expect(tableExists(db, "link_visits")).toBe(true);
      expect(tableExists(db, "user_settings")).toBe(true);
    });
  });

  describe("Migration 006: Magic Token Redirect Origin", () => {
    it("adds redirect_origin column to magic_tokens", () => {
      runMigrations(db, 6);

      expect(getSchemaVersion(db)).toBe(6);
      expect(columnExists(db, "magic_tokens", "redirect_origin")).toBe(true);
    });
  });

  describe("Migration 007: Category Updated At", () => {
    it("adds updated_at column to categories", () => {
      runMigrations(db, 7);

      expect(getSchemaVersion(db)).toBe(7);
      expect(columnExists(db, "categories", "updated_at")).toBe(true);
    });

    it("sets initial updated_at value for existing categories", () => {
      // Create a category before migration 007
      runMigrations(db, 6);
      db.prepare("INSERT INTO users (email) VALUES ('test@example.com')").run();
      const userId = db
        .prepare("SELECT id FROM users WHERE email = 'test@example.com'")
        .get().id;
      db.prepare(
        "INSERT INTO categories (user_id, name) VALUES (?, 'Test Category')",
      ).run(userId);

      // Run migration 007
      runMigrations(db, 7);

      // Check that updated_at is set
      const category = db
        .prepare(
          "SELECT updated_at FROM categories WHERE name = 'Test Category'",
        )
        .get();
      expect(category.updated_at).toBeTruthy();
    });
  });

  describe("Schema Integrity", () => {
    beforeEach(() => {
      runMigrations(db);
    });

    it("enforces foreign keys", () => {
      // Try to create a link with non-existent user_id
      expect(() => {
        db.prepare(
          "INSERT INTO links (user_id, url, title) VALUES (99999, 'http://example.com', 'Test')",
        ).run();
      }).toThrow();
    });

    it("enforces unique constraints on users.email", () => {
      db.prepare("INSERT INTO users (email) VALUES ('test@example.com')").run();

      // Try to insert duplicate email
      expect(() => {
        db.prepare(
          "INSERT INTO users (email) VALUES ('test@example.com')",
        ).run();
      }).toThrow();
    });

    it("allows NULL category_id on links (for uncategorized)", () => {
      db.prepare("INSERT INTO users (email) VALUES ('test@example.com')").run();
      const userId = db
        .prepare("SELECT id FROM users WHERE email = 'test@example.com'")
        .get().id;

      // Should not throw
      const info = db
        .prepare(
          "INSERT INTO links (user_id, url, title, hash, category_id) VALUES (?, 'http://example.com', 'Test', 'testhash123', NULL)",
        )
        .run(userId);

      expect(info.lastInsertRowid).toBeGreaterThan(0);
    });

    it("cascades delete from categories to category_share_members", () => {
      // Create user, category, and share
      db.prepare(
        "INSERT INTO users (email) VALUES ('owner@example.com')",
      ).run();
      const ownerId = db
        .prepare("SELECT id FROM users WHERE email = 'owner@example.com'")
        .get().id;

      db.prepare(
        "INSERT INTO categories (user_id, name) VALUES (?, 'Shared Category')",
      ).run(ownerId);
      const categoryId = db
        .prepare("SELECT id FROM categories WHERE name = 'Shared Category'")
        .get().id;

      db.prepare(
        "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, 'TESTCODE', ?)",
      ).run(categoryId, ownerId);

      db.prepare(
        "INSERT INTO users (email) VALUES ('member@example.com')",
      ).run();
      const memberId = db
        .prepare("SELECT id FROM users WHERE email = 'member@example.com'")
        .get().id;

      db.prepare(
        "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
      ).run(categoryId, memberId);

      // Delete the category (should cascade to both shares and members)
      db.prepare("DELETE FROM categories WHERE id = ?").run(categoryId);

      // Check that member was cascaded
      const member = db
        .prepare(
          "SELECT * FROM category_share_members WHERE category_id = ? AND user_id = ?",
        )
        .get(categoryId, memberId);
      expect(member).toBeUndefined();

      // Check that share was also cascaded
      const share = db
        .prepare("SELECT * FROM category_shares WHERE category_id = ?")
        .get(categoryId);
      expect(share).toBeUndefined();
    });
  });
});
