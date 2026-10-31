/**
 * Tests for the host updater (deploy/updater/hiddenshelf-updater.sh).
 *
 * The real script runs against real git repositories in a temp folder
 * (a bare "origin" and the server's checkout). Docker is a fake on PATH that
 * keeps image tags and the running image in files, and runs "sh -c"
 * commands locally with /app pointing at the checkout, which is what the
 * bind mounts do in production. The fake sqlite3 answers the request lookup
 * from FAKE_REQUEST_ROW and copies files for ".backup".
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(repoRoot, "deploy/updater/hiddenshelf-updater.sh");
const hasTools =
  spawnSync("bash", ["--version"]).status === 0 &&
  spawnSync("git", ["--version"]).status === 0 &&
  spawnSync("flock", ["--version"]).status === 0;

const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
S="$FAKE_STATE"
tagfile() { printf '%s/tag_%s' "$S" "$(printf '%s' "$1" | tr ':/' '__')"; }
resolve() { case "$1" in sha256:*) echo "$1" ;; *) cat "$(tagfile "$1")" 2>/dev/null ;; esac; }
running() { [ -s "$S/running" ] && [ ! -f "$S/stopped" ]; }
run_sh() {
  while [ $# -gt 0 ]; do
    if [ "$1" = "-c" ]; then shift; cmd=$(printf '%s' "$1" | sed "s#/app#$FAKE_APP#g"); exec sh -c "$cmd"; fi
    if [ "$1" = "sqlite3" ]; then shift; exec sqlite3 "$@"; fi
    if [ "$1" = "node" ]; then
      id=$(cat "$S/running" 2>/dev/null)
      grep -qx "$id" "$S/unhealthy" 2>/dev/null && exit 1
      exit 0
    fi
    shift
  done
}
case "$1" in
  image) id=$(resolve "$5"); [ -n "$id" ] && echo "$id" ;;
  tag) id=$(resolve "$2"); [ -n "$id" ] || exit 1; echo "$id" > "$(tagfile "$3")" ;;
  inspect) running && cat "$S/running" ;;
  compose)
    shift
    case "$1" in
      ps) if running; then case "$*" in *--services*) echo web ;; *) echo cid123 ;; esac; fi ;;
      build)
        echo "build GIT_COMMIT=$GIT_COMMIT" >> "$FAKE_LOG"
        [ -n "$FAKE_BUILD_FAIL" ] && exit 1
        n=$(( $(cat "$S/counter" 2>/dev/null || echo 0) + 1 )); echo $n > "$S/counter"
        id="sha256:$(printf '%064d' "$n")"
        echo "$id" > "$(tagfile hiddenshelf:latest)"
        [ -n "$FAKE_UNHEALTHY_BUILD" ] && echo "$id" >> "$S/unhealthy"
        exit 0 ;;
      up)
        rm -f "$S/stopped"
        id=$(resolve hiddenshelf:latest); echo "$id" > "$S/running"
        # A broken new version that still touches the database before dying
        grep -qx "$id" "$S/unhealthy" 2>/dev/null && echo "changed by broken version" >> "$FAKE_APP/db/database.sqlite"
        exit 0 ;;
      stop) touch "$S/stopped" ;;
      exec|run) shift; run_sh "$@" ;;
    esac ;;
esac
`;

const FAKE_SQLITE3 = `#!/usr/bin/env bash
if [ "$1" = "-readonly" ]; then echo "$FAKE_REQUEST_ROW"; exit 0; fi
case "$2" in .backup*) cp "$1" "\${2#.backup }" ;; *) exit 1 ;; esac
`;

const OLD_IMAGE = `sha256:${"a".repeat(64)}`;
const ID = "0123456789abcdef0123456789abcdef";

describe.skipIf(!hasTools)("host updater", () => {
  let dir, origin, server, other, bin, state, log, env;

  const git = (cwd, ...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", env: gitEnv(), stdio: ["ignore", "pipe", "pipe"] }).trim();
  const gitEnv = () => ({
    ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  });

  function commit(cwd, file, content, message) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), content);
    git(cwd, "add", "-A");
    git(cwd, "commit", "-q", "-m", message);
    return git(cwd, "rev-parse", "HEAD");
  }

  function run(mode, extraEnv = {}) {
    return spawnSync("bash", [path.join(server, "deploy/updater/hiddenshelf-updater.sh"), mode], {
      env: { ...env, ...extraEnv },
      encoding: "utf8",
    });
  }

  function request(row, id = ID) {
    fs.writeFileSync(path.join(server, "control/inbox/request"), id + "\n");
    return row;
  }

  function kv(name) {
    const file = path.join(server, "control/status", name);
    if (!fs.existsSync(file)) return {};
    return Object.fromEntries(
      fs.readFileSync(file, "utf8").split("\n").filter(Boolean)
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  }

  const now = () => Math.floor(Date.now() / 1000);
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "");
  const runningImage = () => fs.readFileSync(path.join(state, "running"), "utf8").trim();
  const dbText = () => fs.readFileSync(path.join(server, "db/database.sqlite"), "utf8");

  let A, B;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-updater-"));
    origin = path.join(dir, "origin.git");
    server = path.join(dir, "server");
    other = path.join(dir, "other");
    git(dir, "init", "-q", "--bare", "-b", "main", origin);
    git(dir, "clone", "-q", origin, server);
    git(server, "checkout", "-q", "-b", "main");
    fs.writeFileSync(path.join(server, ".gitignore"), "db/\ncontrol/\n");
    fs.mkdirSync(path.join(server, "deploy/updater"), { recursive: true });
    fs.copyFileSync(script, path.join(server, "deploy/updater/hiddenshelf-updater.sh"));
    A = commit(server, "backend/migrations/001_initial.sql", "-- 1\n", "First version");
    git(server, "push", "-q", "origin", "main");
    git(server, "branch", "-q", "--set-upstream-to=origin/main");

    git(dir, "clone", "-q", origin, other);
    B = commit(other, "backend/migrations/002_more.sql", "-- 2\n", "Add a table");
    git(other, "push", "-q", "origin", "main");

    fs.mkdirSync(path.join(server, "db"));
    fs.writeFileSync(path.join(server, "db/database.sqlite"), "original data\n");
    fs.mkdirSync(path.join(server, "control/inbox"), { recursive: true });

    bin = path.join(dir, "bin");
    state = path.join(dir, "docker");
    fs.mkdirSync(bin);
    fs.mkdirSync(state);
    fs.writeFileSync(path.join(bin, "docker"), FAKE_DOCKER, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "sqlite3"), FAKE_SQLITE3, { mode: 0o755 });
    fs.writeFileSync(path.join(state, "tag_hiddenshelf_latest"), OLD_IMAGE + "\n");
    fs.writeFileSync(path.join(state, "running"), OLD_IMAGE + "\n");

    log = path.join(dir, "calls.log");
    env = {
      ...gitEnv(),
      PATH: `${bin}:${process.env.PATH}`,
      FAKE_APP: server, FAKE_LOG: log, FAKE_STATE: state,
      UPDATER_HEALTH_TIMEOUT: "0.4", UPDATER_HEALTH_INTERVAL: "0.1",
      UPDATER_MIN_FREE_KB: "1",
    };
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("lists the commits an update would bring in", () => {
    expect(run("check").status).toBe(0);
    expect(kv("check")).toMatchObject({ ok: "yes", target: B, count: "1", migrations: "yes" });
    const available = fs.readFileSync(path.join(server, "control/status/available"), "utf8");
    expect(available).toContain(`${B}\t`);
    expect(available).toContain("Add a table");
    expect(kv("current").commit).toBe(A);
  });

  it("updates, backs up first and keeps the old image for a rollback", () => {
    const row = request(`update|${B}|${now()}`);
    const res = run("run", { FAKE_REQUEST_ROW: row });
    expect(res.status).toBe(0);
    expect(kv("job")).toMatchObject({ id: ID, action: "update", state: "succeeded", from: A, to: B });
    expect(git(server, "rev-parse", "HEAD")).toBe(B);
    expect(runningImage()).not.toBe(OLD_IMAGE);
    expect(calls()).toContain(`build GIT_COMMIT=${B}`);
    expect(fs.readFileSync(path.join(state, "tag_hiddenshelf_previous"), "utf8").trim()).toBe(OLD_IMAGE);
    const backups = fs.readdirSync(path.join(server, "db/backups"));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^pre-update-\d{8}-\d{6}\.sqlite$/);
    expect(kv("rollback")).toMatchObject({ commit: A, image: OLD_IMAGE, db_restore: "yes", backup: backups[0] });
    expect(fs.existsSync(path.join(server, "control/inbox/request"))).toBe(false);
    expect(kv("check")).toMatchObject({ count: "0" });
  });

  it("refuses when main moved after the admin looked", () => {
    const res = run("run", { FAKE_REQUEST_ROW: request(`update|${A}|${now()}`) });
    expect(res.status).not.toBe(0);
    expect(kv("job").state).toBe("failed");
    expect(kv("job").message).toContain("has changed since you looked");
    expect(git(server, "rev-parse", "HEAD")).toBe(A);
    expect(calls()).not.toContain("compose build");
  });

  it("ignores a request file that is not a plain id, without running anything", () => {
    fs.writeFileSync(path.join(server, "control/inbox/request"), "$(touch /tmp/hs-pwned); rm -rf /\n");
    const res = run("run", { FAKE_REQUEST_ROW: `update|${B}|${now()}` });
    expect(res.status).not.toBe(0);
    expect(kv("job").message).toContain("not a valid id");
    expect(calls()).toBe("");
    expect(fs.existsSync(path.join(server, "control/inbox/request"))).toBe(false);
  });

  it("ignores an id the app has no request for", () => {
    const res = run("run", { FAKE_REQUEST_ROW: request("") });
    expect(res.status).not.toBe(0);
    expect(kv("job").message).toContain("No matching request");
    expect(git(server, "rev-parse", "HEAD")).toBe(A);
  });

  it("handles each request only once", () => {
    const row = `update|${B}|${now()}`;
    run("run", { FAKE_REQUEST_ROW: request(row) });
    git(server, "reset", "-q", "--hard", A);
    const res = run("run", { FAKE_REQUEST_ROW: request(row) });
    expect(res.status).not.toBe(0);
    expect(kv("job").message).toContain("already handled");
    expect(git(server, "rev-parse", "HEAD")).toBe(A);
  });

  it("refuses an old request", () => {
    const res = run("run", { FAKE_REQUEST_ROW: request(`update|${B}|${now() - 3600}`) });
    expect(res.status).not.toBe(0);
    expect(kv("job").message).toContain("too old");
  });

  it("refuses when the checkout was changed by hand", () => {
    fs.writeFileSync(path.join(server, "backend/migrations/001_initial.sql"), "-- edited\n");
    const res = run("run", { FAKE_REQUEST_ROW: request(`update|${B}|${now()}`) });
    expect(res.status).not.toBe(0);
    expect(kv("job").message).toContain("changed by hand");
    expect(calls()).not.toContain("compose build");
  });

  it("changes nothing when the build fails", () => {
    const res = run("run", { FAKE_REQUEST_ROW: request(`update|${B}|${now()}`), FAKE_BUILD_FAIL: "1" });
    expect(res.status).not.toBe(0);
    expect(kv("job").message).toContain("build failed");
    expect(git(server, "rev-parse", "HEAD")).toBe(A);
    expect(runningImage()).toBe(OLD_IMAGE);
    expect(calls()).not.toContain("compose up");
  });

  it("rolls back by itself, database included, when the new version is unhealthy", () => {
    const res = run("run", { FAKE_REQUEST_ROW: request(`update|${B}|${now()}`), FAKE_UNHEALTHY_BUILD: "1" });
    expect(res.status).not.toBe(0);
    expect(kv("job").state).toBe("rolled_back");
    expect(git(server, "rev-parse", "HEAD")).toBe(A);
    expect(runningImage()).toBe(OLD_IMAGE);
    expect(dbText()).toBe("original data\n");
    expect(kv("rollback")).toEqual({});
  });

  it("goes back one version when an admin asks for a rollback", () => {
    run("run", { FAKE_REQUEST_ROW: request(`update|${B}|${now()}`) });
    fs.appendFileSync(path.join(server, "db/database.sqlite"), "added after update\n");
    const res = run("run", { FAKE_REQUEST_ROW: request(`rollback||${now()}`, "f".repeat(32)) });
    expect(res.status).toBe(0);
    expect(kv("job")).toMatchObject({ action: "rollback", state: "succeeded", to: A });
    expect(git(server, "rev-parse", "HEAD")).toBe(A);
    expect(runningImage()).toBe(OLD_IMAGE);
    // A migration came with the update, so the database goes back too, after a safety copy
    expect(dbText()).toBe("original data\n");
    const backups = fs.readdirSync(path.join(server, "db/backups"));
    expect(backups.some((f) => f.startsWith("pre-rollback-"))).toBe(true);
    expect(kv("rollback")).toEqual({});
    expect(kv("check")).toMatchObject({ count: "1", target: B });
  });

  it("refuses a rollback when there is nothing to go back to", () => {
    const res = run("run", { FAKE_REQUEST_ROW: request(`rollback||${now()}`) });
    expect(res.status).not.toBe(0);
    expect(kv("job").message).toContain("no previous version");
    expect(runningImage()).toBe(OLD_IMAGE);
  });
});
