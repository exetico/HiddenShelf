import { describe, expect, it } from "vitest";
import { appUrl, cleanUrlFromLegacyHash } from "@/lib/appUrl";

describe("cleanUrlFromLegacyHash", () => {
  it("turns an old hash URL into the clean route", () => {
    expect(cleanUrlFromLegacyHash({ hash: "#/login?share=abc" })).toBe(
      "/login?share=abc",
    );
    expect(cleanUrlFromLegacyHash({ hash: "#/dashboard" }, "/")).toBe(
      "/dashboard",
    );
  });

  it("keeps the subpath of a subpath deploy", () => {
    expect(cleanUrlFromLegacyHash({ hash: "#/view" }, "/shelf/")).toBe(
      "/shelf/view",
    );
  });

  it("sends the old app address without a route to the dashboard", () => {
    expect(
      cleanUrlFromLegacyHash({ hash: "", pathname: "/public/app/index.html" }),
    ).toBe("/dashboard");
    expect(
      cleanUrlFromLegacyHash(
        { hash: "", pathname: "/shelf/public/app/index.html" },
        "/shelf/",
      ),
    ).toBe("/shelf/dashboard");
  });

  it("leaves clean URLs and plain anchors alone", () => {
    expect(cleanUrlFromLegacyHash({ hash: "", pathname: "/view" })).toBeNull();
    expect(cleanUrlFromLegacyHash({ hash: "" })).toBeNull();
    expect(cleanUrlFromLegacyHash({ hash: "#sharing" })).toBeNull();
  });
});

describe("appUrl", () => {
  it("builds an absolute URL for a route", () => {
    expect(appUrl("/login?share=x", "/")).toBe(
      `${window.location.origin}/login?share=x`,
    );
    expect(appUrl("/dashboard", "/shelf/")).toBe(
      `${window.location.origin}/shelf/dashboard`,
    );
  });
});
