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
    expect(typeof data.signup_enabled).toBe("boolean");
    expect(typeof data.google_auth_enabled).toBe("boolean");
  });
});
