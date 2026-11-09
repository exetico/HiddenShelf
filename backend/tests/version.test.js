/**
 * The version the app shows (lib/version.js): the release tag, else the
 * branch and short commit, never a made-up number.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import config from "../src/config.js";
import { appVersion } from "../src/lib/version.js";
import { createTestApp, cleanup, json } from "./helpers.js";

const COMMIT = "abc1234def5678abc1234def5678abc1234def56";

describe("app version", () => {
  const saved = {};
  beforeEach(() => {
    saved.commit = config.gitCommit;
    saved.tag = config.gitTag;
    saved.branch = config.gitBranch;
  });
  afterEach(() => {
    config.gitCommit = saved.commit;
    config.gitTag = saved.tag;
    config.gitBranch = saved.branch;
    cleanup();
  });

  it("is the release tag when the commit has one", () => {
    Object.assign(config, { gitCommit: COMMIT, gitTag: "v1.2.0", gitBranch: "main" });
    expect(appVersion()).toBe("v1.2.0");
  });

  it("is the branch and short commit between releases", () => {
    Object.assign(config, { gitCommit: COMMIT, gitTag: "", gitBranch: "main" });
    expect(appVersion()).toBe("main · abc1234");
    config.gitBranch = "";
    expect(appVersion()).toBe("abc1234");
  });

  it("is empty when the build doesn't say, rather than a made-up number", async () => {
    Object.assign(config, { gitCommit: "", gitTag: "", gitBranch: "" });
    expect(appVersion()).toBe("");
    const res = await createTestApp().request("/api/config");
    expect((await json(res)).app_version).toBe("");
  });
});
