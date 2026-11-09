/**
 * Tests for /api/config endpoint.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, cleanup, json } from "./helpers.js";

describe("Config API", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    cleanup();
  });

  it("returns app config (public, no auth required)", async () => {
    const res = await app.request("/api/config");
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.success).toBe(true);
    expect(data.app_version).toBeDefined();
    expect(data.site_name).toBeDefined();
    expect(["open", "approval", "invite"]).toContain(data.signup_mode);
    expect(data.signup_enabled).toBeUndefined();
    expect(typeof data.google_auth_enabled).toBe("boolean");
  });
});

describe("BASE_PATH parsing", () => {
  it("accepts a path and drops a trailing slash", async () => {
    const { basePathFromEnv } = await import("../src/config.js");
    expect(basePathFromEnv("/shelf/")).toBe("/shelf");
    expect(basePathFromEnv("")).toBe("");
    expect(basePathFromEnv(undefined)).toBe("");
  });

  it("ignores a comment that a .env parser kept as the value", async () => {
    const { basePathFromEnv } = await import("../src/config.js");
    expect(basePathFromEnv("# Subpath if behind a proxy, e.g. /shelf")).toBe("");
    expect(basePathFromEnv("shelf")).toBe("");
  });
});
