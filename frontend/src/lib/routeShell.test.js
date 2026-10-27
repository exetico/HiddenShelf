import { describe, expect, it } from "vitest";
import { usesAppShell } from "@/lib/routeShell";

describe("usesAppShell", () => {
  it("wraps app pages, not public ones", () => {
    expect(usesAppShell({})).toBe(true);
    expect(usesAppShell({ public: true }, true)).toBe(false);
  });

  it("wraps Help only when you're signed in", () => {
    const help = { public: true, shellWhenSignedIn: true };
    expect(usesAppShell(help, true)).toBe(true);
    expect(usesAppShell(help, false)).toBe(false);
  });
});
