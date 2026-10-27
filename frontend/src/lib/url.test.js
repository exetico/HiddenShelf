import { describe, expect, it } from "vitest";
import { withScheme } from "@/lib/url";

describe("withScheme", () => {
  it("uses http for addresses on your own network", () => {
    expect(withScheme("192.168.1.10")).toBe("http://192.168.1.10");
    expect(withScheme(" 10.0.0.2:8123/lovelace ")).toBe("http://10.0.0.2:8123/lovelace");
    expect(withScheme("localhost:3000")).toBe("http://localhost:3000");
    expect(withScheme("nas:5000")).toBe("http://nas:5000");
    expect(withScheme("printer.lan")).toBe("http://printer.lan");
    expect(withScheme("[::1]:8080")).toBe("http://[::1]:8080");
    expect(withScheme("grafana.example.com:3000")).toBe("http://grafana.example.com:3000");
  });

  it("uses https for sites on the web", () => {
    expect(withScheme("example.com")).toBe("https://example.com");
    expect(withScheme("www.example.com/a?b=1#c")).toBe("https://www.example.com/a?b=1#c");
  });

  it("leaves addresses with a scheme, and things that aren't addresses, alone", () => {
    expect(withScheme("https://example.com")).toBe("https://example.com");
    expect(withScheme("HTTP://10.0.0.1")).toBe("HTTP://10.0.0.1");
    expect(withScheme("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(withScheme("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(withScheme("notes")).toBe("notes");
    expect(withScheme("")).toBe("");
    expect(withScheme(undefined)).toBe("");
  });

  it("matches the server's copy", async () => {
    const server = await import("../../../backend/src/lib/helpers.js").catch(() => null);
    if (!server) return; // only when the backend is next to the frontend
    for (const input of ["192.168.1.10", "nas:5000", "example.com", "notes", "javascript:x"]) {
      expect(withScheme(input)).toBe(server.withScheme(input));
    }
  });
});
