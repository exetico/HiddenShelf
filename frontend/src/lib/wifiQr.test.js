import { describe, expect, it } from "vitest";
import { wifiPayload } from "@/lib/wifiQr";

describe("wifiPayload", () => {
  it("builds the text phones read to join a network", () => {
    expect(wifiPayload({ ssid: "Home", password: "secret" })).toBe("WIFI:T:WPA;S:Home;P:secret;;");
    expect(wifiPayload({ ssid: "Cafe", security: "nopass", password: "ignored" })).toBe("WIFI:T:nopass;S:Cafe;;");
    expect(wifiPayload({ ssid: "Lab", password: "x", hidden: true })).toBe("WIFI:T:WPA;S:Lab;P:x;H:true;;");
  });

  it("escapes the characters that would break it", () => {
    expect(wifiPayload({ ssid: 'a;b,c:d"e\\f', password: "p;w" })).toBe(String.raw`WIFI:T:WPA;S:a\;b\,c\:d\"e\\f;P:p\;w;;`);
  });

  it("is empty without a network name", () => {
    expect(wifiPayload({ ssid: "" })).toBe("");
  });
});
