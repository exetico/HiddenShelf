/**
 * Whether the app can reach the server right now.
 *
 * When a request can't get through (the network is down, or the server is
 * restarting after an update and the proxy in front of it answers with its
 * own error page), httpClient calls reportDown(). From then on this checks
 * /api/health every few seconds, a little slower each time, and as soon as
 * the server answers again it marks the connection up and calls whoever
 * asked to hear about it (onReconnect), so pages can load what they missed.
 *
 * Nothing here grants access: it only decides when to ask the server again.
 * Every page still needs the server's own answer before it shows anything.
 */
import { reactive } from "vue";

// Wait before each health check: 2s, 4s, 8s, then every 15s
const DELAYS_MS = [2000, 4000, 8000, 15000];

export const connection = reactive({
  down: false,
  // When the next check runs (ms since epoch), for "Trying again in 5s"
  nextTryAt: 0,
  checking: false,
});

let attempt = 0;
let timer = null;
let healthUrl = "/api/health";
const listeners = new Set();
let waiters = [];
let windowHooked = false;
let pageshowHooked = false;
let lastUpAt = 0;

/** Where the health check lives (httpClient sets it, with the base path) */
export function setHealthUrl(url) {
  healthUrl = url;
}

/**
 * Calls fn each time the server answers again after being unreachable, and
 * when the browser brings back a page it kept in memory (reopening a tab or
 * going Back), since what that page shows may be out of date.
 */
export function onReconnect(fn) {
  hookPageshow();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Resolves once the server can be reached (at once if it already can). */
export function whenUp() {
  if (!connection.down) return Promise.resolve();
  return new Promise((resolve) => waiters.push(resolve));
}

/** A request couldn't reach the server: start checking until it can. */
export function reportDown() {
  if (connection.down) return;
  connection.down = true;
  // Down again right after coming back: don't hammer it, keep slowing down
  if (Date.now() - lastUpAt > 30_000) attempt = 0;
  hookWindow();
  schedule();
}

/** Check now instead of waiting (the "Try now" button, or back online). */
export function retryNow() {
  if (!connection.down || connection.checking) return Promise.resolve();
  clearTimeout(timer);
  return check();
}

function schedule() {
  clearTimeout(timer);
  const delay = DELAYS_MS[Math.min(attempt, DELAYS_MS.length - 1)];
  connection.nextTryAt = Date.now() + delay;
  timer = setTimeout(check, delay);
}

async function check() {
  connection.checking = true;
  let up = false;
  try {
    const response = await fetch(healthUrl, { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      const body = await response.json();
      up = body?.ok === true;
    }
  } catch {
    up = false;
  } finally {
    connection.checking = false;
  }
  if (!connection.down) return;
  if (up) {
    markUp();
  } else {
    attempt += 1;
    schedule();
  }
}

function notify() {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (err) {
      console.error("[connection]", err);
    }
  }
}

// A page restored from the browser's memory (back/forward cache) runs no
// code on its own; load again what it shows
function hookPageshow() {
  if (pageshowHooked || typeof window === "undefined") return;
  pageshowHooked = true;
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) notify();
  });
}

function markUp() {
  clearTimeout(timer);
  connection.down = false;
  connection.nextTryAt = 0;
  lastUpAt = Date.now();
  const resolve = waiters;
  waiters = [];
  resolve.forEach((r) => r());
  notify();
}

// Coming back online, or back to the tab (phones pause timers in the
// background), is a good moment to check at once.
function hookWindow() {
  if (windowHooked || typeof window === "undefined") return;
  windowHooked = true;
  window.addEventListener("online", () => retryNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") retryNow();
  });
}

/** For tests: back to the start */
export function resetConnection() {
  clearTimeout(timer);
  connection.down = false;
  connection.nextTryAt = 0;
  connection.checking = false;
  attempt = 0;
  lastUpAt = 0;
  listeners.clear();
  waiters = [];
}
