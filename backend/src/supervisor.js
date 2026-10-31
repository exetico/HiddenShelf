/**
 * The container's main process. It runs the web app as a child process and,
 * when in-app updates are on (UPDATE_ADMIN_EMAILS), the self-updater
 * (selfupdate/updater.js): it watches for an admin's flag, checks for new
 * versions hourly, and swaps the running app for a newer build.
 *
 * The app itself never builds or restarts anything; it only leaves a flag.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { createUpdater } from "./selfupdate/updater.js";

const imageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const updatesOn = config.updateAdminEmails.length > 0;

let child = null;
let stopping = false;
let running = { dir: imageDir, commit: config.gitCommit };
let crashes = [];

const controller = {
  async start(dir, commit) {
    running = { dir, commit };
    stopping = false;
    child = spawn(process.execPath, [path.join(dir, "backend", "src", "index.js")], {
      cwd: process.cwd(),
      env: { ...process.env, GIT_COMMIT: commit || "" },
      stdio: "inherit",
    });
    const me = child;
    me.on("exit", (code, signal) => {
      if (child === me) child = null;
      if (stopping) return;
      console.error(`[supervisor] App exited (${signal || code}); restarting`);
      // A version that keeps crashing right after start falls back to the image
      crashes = [...crashes.filter((t) => Date.now() - t < 120_000), Date.now()];
      if (crashes.length >= 3 && running.dir !== imageDir) {
        console.error("[supervisor] The updated version keeps crashing; starting the image's version");
        crashes = [];
        updater?.forgetCurrent?.();
        setTimeout(() => controller.start(imageDir, config.gitCommit), 1000);
      } else {
        setTimeout(() => controller.start(running.dir, running.commit), 2000);
      }
    });
  },
  async stop() {
    stopping = true;
    const c = child;
    if (!c) return;
    await new Promise((resolve) => {
      const kill = setTimeout(() => c.kill("SIGKILL"), 10_000);
      c.once("exit", () => {
        clearTimeout(kill);
        resolve();
      });
      c.kill("SIGTERM");
    });
  },
  async healthy(timeoutMs) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (!child) return false;
      try {
        const res = await fetch(`http://127.0.0.1:${config.port}/api/health`);
        if (res.ok) return true;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  },
};

let updater = null;
if (updatesOn) {
  try {
    if (!/^https:\/\/[^\s@]+$/.test(config.updateRepoUrl)) {
      throw new Error("UPDATE_REPO_URL must be an https:// URL without credentials");
    }
    updater = createUpdater({
      varDir: path.resolve(config.updateControlDir),
      imageDir,
      imageCommit: config.gitCommit,
      repoUrl: config.updateRepoUrl,
      branch: config.updateBranch,
      dbPath: path.resolve(config.dbPath),
      controller,
    });
    updater.setup();
  } catch (err) {
    console.error("[supervisor] In-app updates are off:", err.message);
    updater = null;
  }
}

const first = updater ? updater.startupChoice() : { dir: imageDir, commit: config.gitCommit };
if (first.dir !== imageDir) console.log(`[supervisor] Running the updated version ${first.commit.slice(0, 7)}`);
await controller.start(first.dir, first.commit);

if (updater) {
  let busy = false;
  let lastCheck = 0;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      if (await updater.runPending()) lastCheck = Date.now();
      else if (Date.now() - lastCheck > 60 * 60 * 1000) {
        lastCheck = Date.now();
        updater.check();
      }
    } catch (err) {
      console.error("[supervisor]", err.message);
    } finally {
      busy = false;
    }
  }, 3000);
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    await controller.stop();
    process.exit(0);
  });
}
