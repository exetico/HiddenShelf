/**
 * Tests for the up, backup, restore and upgrade targets in the Makefile.
 *
 * The real Makefile runs in a temp folder with fake docker, sqlite3 and git
 * commands on PATH. The fake docker logs each call and runs the "sh -c"
 * command locally, with /app pointing at the temp folder, which is what the
 * ./db:/app/db bind mount does in production. The fake sqlite3 uses
 * better-sqlite3's backup, like the sqlite CLI's ".backup".
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hasMake = spawnSync("make", ["--version"]).status === 0;

const FAKE_DOCKER = `#!/bin/sh
echo "docker $*" >> "$FAKE_LOG"
# The commit a build is labelled with
if [ -n "$GIT_COMMIT" ]; then echo "$GIT_COMMIT" > "$FAKE_LOG.commit"; fi
if [ "$1 $2" = "compose ps" ]; then [ -n "$FAKE_RUNNING" ] && echo web; exit 0; fi
while [ $# -gt 0 ]; do
  if [ "$1" = "-c" ]; then
    shift
    cmd=$(printf '%s' "$1" | sed "s#/app#$FAKE_APP#g")
    exec sh -c "$cmd"
  fi
  shift
done
`;

const FAKE_SQLITE3 = `#!/usr/bin/env node
const Database = require(${JSON.stringify(require.resolve("better-sqlite3"))});
const [file, command] = process.argv.slice(2);
const target = command.replace(/^\\.backup /, "");
new Database(file, { fileMustExist: true }).backup(target).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
`;

const FAKE_GIT = `#!/bin/sh
echo "git $*" >> "$FAKE_LOG"
case "$1" in
  fetch) [ -z "$FAKE_OFFLINE" ] ;;
  rev-list) echo "\${FAKE_BEHIND:-0}" ;;
  rev-parse) if [ "$2" = HEAD ]; then cat "$FAKE_LOG.head" 2>/dev/null; fi; true ;;
  pull) echo "pulled-commit" > "$FAKE_LOG.head" ;;
esac
`;

describe.skipIf(!hasMake)("Makefile data targets", () => {
  let dir, log, env;

  function make(args, { running = false, input, extraEnv = {} } = {}) {
    const result = spawnSync("make", ["--no-print-directory", ...args], {
      cwd: dir,
      env: { ...env, FAKE_RUNNING: running ? "1" : "", ...extraEnv },
      encoding: "utf8",
      input,
    });
    return { ...result, output: result.stdout + result.stderr };
  }

  function calls() {
    // "git rev-parse HEAD" only reads the commit to label the image with
    return fs.existsSync(log)
      ? fs.readFileSync(log, "utf8").trim().split("\n").filter((l) => l && l !== "git rev-parse HEAD")
      : [];
  }

  function titles(file) {
    const db = new Database(path.join(dir, file), { readonly: true });
    const rows = db.prepare("SELECT title FROM links ORDER BY id").all();
    db.close();
    return rows.map((r) => r.title);
  }

  function addLink(title) {
    const db = new Database(path.join(dir, "db/database.sqlite"));
    db.prepare("INSERT INTO links (title) VALUES (?)").run(title);
    db.close();
  }

  function backups() {
    const folder = path.join(dir, "db/backups");
    return fs.existsSync(folder) ? fs.readdirSync(folder).sort() : [];
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-make-"));
    fs.copyFileSync(path.join(repoRoot, "Makefile"), path.join(dir, "Makefile"));

    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin);
    for (const [name, script] of [["docker", FAKE_DOCKER], ["sqlite3", FAKE_SQLITE3], ["git", FAKE_GIT]]) {
      fs.writeFileSync(path.join(bin, name), script, { mode: 0o755 });
    }

    fs.mkdirSync(path.join(dir, "db"));
    const db = new Database(path.join(dir, "db/database.sqlite"));
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE links (id INTEGER PRIMARY KEY, title TEXT)");
    db.prepare("INSERT INTO links (title) VALUES (?)").run("first");
    db.close();

    log = path.join(dir, "calls.log");
    env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_APP: dir, FAKE_LOG: log };
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe("backup", () => {
    it("copies the database into db/backups/ through the running container", () => {
      const res = make(["backup"], { running: true });
      expect(res.status).toBe(0);

      const files = backups();
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^hiddenshelf-\d{8}-\d{6}\.sqlite$/);
      expect(res.output).toContain(`Backup: db/backups/${files[0]}`);
      expect(titles(`db/backups/${files[0]}`)).toEqual(["first"]);
      expect(calls()).toContainEqual(expect.stringMatching(/^docker compose exec -T web sh -c /));
    });

    it("uses a one-off container when the app is stopped", () => {
      const res = make(["backup"]);
      expect(res.status).toBe(0);
      expect(backups()).toHaveLength(1);
      expect(calls()).toContainEqual(expect.stringMatching(/^docker compose run --rm --no-deps -T web sh -c /));
    });

    it("also copies the backup to OUT", () => {
      const out = path.join(dir, "export.sqlite");
      const res = make(["backup", `OUT=${out}`]);
      expect(res.status).toBe(0);
      expect(res.output).toContain(`Copied to ${out}`);
      expect(titles("export.sqlite")).toEqual(["first"]);
    });

    it("fails when there is no database", () => {
      fs.rmSync(path.join(dir, "db/database.sqlite"));
      const res = make(["backup"]);
      expect(res.status).not.toBe(0);
    });
  });

  describe("restore", () => {
    function saveBackup() {
      make(["backup"]);
      const file = `db/backups/saved.sqlite`;
      fs.renameSync(path.join(dir, "db/backups", backups()[0]), path.join(dir, file));
      return file;
    }

    it("puts the backup back and restarts the app", () => {
      const file = saveBackup();
      addLink("added later");
      fs.writeFileSync(path.join(dir, "db/database.sqlite-wal"), "stale");
      fs.writeFileSync(path.join(dir, "db/database.sqlite-shm"), "stale");
      fs.writeFileSync(log, "");

      const res = make(["restore", `FILE=${file}`], { running: true });
      expect(res.status).toBe(0);
      expect(res.output).toContain(`Restored ${file}`);
      // Checked before opening the database, which creates new ones
      expect(fs.existsSync(path.join(dir, "db/database.sqlite-wal"))).toBe(false);
      expect(fs.existsSync(path.join(dir, "db/database.sqlite-shm"))).toBe(false);
      expect(titles("db/database.sqlite")).toEqual(["first"]);

      const order = calls().filter((c) => /compose (stop|up)/.test(c));
      expect(order).toEqual(["docker compose stop web", "docker compose up -d web"]);
    });

    it("backs up the current database first, so the restore can be undone", () => {
      const file = saveBackup();
      addLink("added later");

      make(["restore", `FILE=${file}`]);
      const before = backups().filter((f) => f.startsWith("hiddenshelf-"));
      expect(before).toHaveLength(1);
      expect(titles(`db/backups/${before[0]}`)).toEqual(["first", "added later"]);
    });

    it("asks for FILE", () => {
      const res = make(["restore"]);
      expect(res.status).not.toBe(0);
      expect(res.output).toContain("Usage: make restore FILE=");
      expect(calls()).toEqual([]);
    });

    it("refuses a file outside db/", () => {
      fs.writeFileSync(path.join(dir, "other.sqlite"), "");
      const res = make(["restore", "FILE=other.sqlite"]);
      expect(res.status).not.toBe(0);
      expect(res.output).toContain("FILE must be inside db/");
      expect(calls()).toEqual([]);
    });

    it("refuses a file that doesn't exist", () => {
      const res = make(["restore", "FILE=db/backups/missing.sqlite"]);
      expect(res.status).not.toBe(0);
      expect(res.output).toContain("db/backups/missing.sqlite not found");
      expect(calls()).toEqual([]);
      expect(titles("db/database.sqlite")).toEqual(["first"]);
    });
  });

  describe("up", () => {
    const pulled = () => calls().includes("git pull --ff-only");

    it("never asks or pulls without a terminal (scripts, cron)", () => {
      const res = make(["up"], { extraEnv: { FAKE_BEHIND: "3" } });
      expect(res.status).toBe(0);
      expect(res.output).not.toContain("[Y/n]");
      expect(calls()).toEqual(["docker compose up -d --build web"]);
    });

    it("asks when there is new code, and updates on yes", () => {
      // PULL=ask stands in for a terminal, which the test can't have
      const res = make(["up", "PULL=ask"], { input: "y\n", extraEnv: { FAKE_BEHIND: "3" } });
      expect(res.status).toBe(0);
      expect(res.output).toContain("3 new commit(s) available. Back up and update before starting? [Y/n]");
      expect(pulled()).toBe(true);
      expect(calls().at(-1)).toBe("docker compose up -d --build web");
      // The new image is labelled with the pulled commit, not the old one
      expect(fs.readFileSync(`${log}.commit`, "utf8").trim()).toBe("pulled-commit");
    });

    it("updates when Enter is pressed (yes is the default)", () => {
      make(["up", "PULL=ask"], { input: "\n", extraEnv: { FAKE_BEHIND: "1" } });
      expect(pulled()).toBe(true);
    });

    it("starts the current code on no", () => {
      const res = make(["up", "PULL=ask"], { input: "n\n", extraEnv: { FAKE_BEHIND: "2" } });
      expect(res.status).toBe(0);
      expect(pulled()).toBe(false);
      expect(calls().at(-1)).toBe("docker compose up -d --build web");
    });

    it("doesn't ask when the code is up to date", () => {
      const res = make(["up", "PULL=ask"], { input: "y\n" });
      expect(res.output).toContain("The code is up to date");
      expect(res.output).not.toContain("[Y/n]");
      expect(pulled()).toBe(false);
    });

    it("starts anyway when it can't check for updates", () => {
      const res = make(["up", "PULL=ask"], { input: "y\n", extraEnv: { FAKE_OFFLINE: "1" } });
      expect(res.status).toBe(0);
      expect(res.output).toContain("Could not check for updates");
      expect(pulled()).toBe(false);
      expect(calls().at(-1)).toBe("docker compose up -d --build web");
    });

    it("PULL=yes updates without asking, PULL=no skips the check", () => {
      make(["up", "PULL=yes"]);
      expect(pulled()).toBe(true);
      expect(calls()).not.toContain("git fetch --quiet");

      fs.writeFileSync(log, "");
      make(["up", "PULL=no"], { extraEnv: { FAKE_BEHIND: "5" } });
      expect(calls()).toEqual(["docker compose up -d --build web"]);
    });
  });

  describe("upgrade", () => {
    it("backs up, pulls, then rebuilds", () => {
      const res = make(["upgrade"], { running: true });
      expect(res.status).toBe(0);
      expect(backups()).toHaveLength(1);

      const steps = calls().filter((c) => !c.startsWith("docker compose ps"));
      expect(steps[0]).toMatch(/^docker compose exec -T web sh -c /);
      expect(steps.slice(1)).toEqual(["git pull --ff-only", "docker compose up -d --build web"]);
    });

    it("skips the backup when the app is not running", () => {
      const res = make(["upgrade"]);
      expect(res.status).toBe(0);
      expect(res.output).toContain("App is not running, skipping backup");
      expect(backups()).toEqual([]);
      expect(calls()).toContain("git pull --ff-only");
    });
  });

  it("the image has the sqlite3 command that backup uses", () => {
    const dockerfile = fs.readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/apk add[^\n]*\bsqlite\b/);
  });

  it("db/ is not tracked by git, so a pull never touches the data", () => {
    const ignored = execFileSync("git", ["check-ignore", "db/database.sqlite", "db/backups/x.sqlite"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(ignored.trim().split("\n")).toHaveLength(2);
  });
});
