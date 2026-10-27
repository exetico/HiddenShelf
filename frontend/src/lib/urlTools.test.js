import { describe, expect, it } from "vitest";
import {
  cleanTracking,
  decodeText,
  encodeText,
  isTrackingParam,
  parseUrl,
  toolHref,
  toolQuery,
  urlParts,
} from "@/lib/urlTools";

describe("urlTools", () => {
  it("reads addresses with or without a scheme", () => {
    expect(parseUrl("example.com/a")?.href).toBe("https://example.com/a");
    expect(parseUrl("192.168.1.5:8080")?.href).toBe("http://192.168.1.5:8080/");
    expect(parseUrl("not an address")).toBeNull();
    expect(parseUrl("")).toBeNull();
  });

  it("knows tracking parameters", () => {
    expect(["utm_source", "UTM_Campaign", "fbclid", "gclid", "mc_eid"].every(isTrackingParam)).toBe(true);
    expect(["q", "id", "page", "ref"].some(isTrackingParam)).toBe(false);
  });

  it("takes tracking off and keeps the rest", () => {
    expect(
      cleanTracking("https://shop.dk/p?id=4&utm_source=mail&utm_medium=x&fbclid=abc#top"),
    ).toEqual({ url: "https://shop.dk/p?id=4#top", removed: ["utm_source", "utm_medium", "fbclid"] });
    expect(cleanTracking("https://shop.dk/p?id=4")).toEqual({ url: "https://shop.dk/p?id=4", removed: [] });
    expect(cleanTracking("nope")).toBeNull();
  });

  it("splits an address into parts", () => {
    expect(urlParts("http://nas.local:5000/a%20b/?q=hi+there&utm_source=x#sec")).toEqual({
      protocol: "http",
      host: "nas.local",
      port: "5000",
      path: "/a b/",
      hash: "sec",
      params: [
        { name: "q", value: "hi there", tracking: false },
        { name: "utm_source", value: "x", tracking: true },
      ],
    });
  });

  it("encodes a query value or a whole address", () => {
    expect(encodeText("a b&c=d/é")).toBe("a%20b%26c%3Dd%2F%C3%A9");
    expect(encodeText("https://x.dk/a b?q=é&r=1", "url")).toBe("https://x.dk/a%20b?q=%C3%A9&r=1");
  });

  it("decodes, with + as a space, and throws on broken input", () => {
    expect(decodeText("a%20b+c%C3%A9")).toBe("a b cé");
    expect(() => decodeText("100%")).toThrow();
  });

  it("builds tool addresses", () => {
    expect(toolQuery("qr")).toEqual({});
    expect(toolQuery("clean")).toEqual({ tool: "clean" });
    expect(toolHref("encode", "/shelf/")).toBe("/shelf/tools?tool=encode");
    expect(toolHref("qr", "/")).toBe("/tools");
  });
});
