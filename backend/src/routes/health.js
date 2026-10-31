/**
 * Health check for the host updater (and any monitor): 200 when the app
 * answers and its database can be read. Reveals nothing else.
 *
 * Endpoint: GET /api/health
 */

import { Hono } from "hono";
import { getDb } from "../lib/database.js";

const health = new Hono();

health.get("/", (c) => {
  c.header("Cache-Control", "no-store");
  try {
    getDb().prepare("SELECT 1").get();
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

export default health;
