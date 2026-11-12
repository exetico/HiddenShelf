import { describe, it, expect } from "vitest";
import { daysLeft, shareEnded, shareStatus } from "./shareLink";

const now = Date.parse("2026-11-12T12:00:00Z");
const inDays = (d) => new Date(now + d * 86_400_000).toISOString();

describe("share link words", () => {
  it("counts whole days left, rounded up", () => {
    expect(daysLeft(inDays(7), now)).toBe(7);
    expect(daysLeft(inDays(6.2), now)).toBe(7);
    expect(daysLeft(inDays(0.1), now)).toBe(1);
    expect(daysLeft(inDays(-1), now)).toBe(0);
    expect(daysLeft(null, now)).toBe(0);
  });

  it("treats a missing end date or the expired flag as ended", () => {
    expect(shareEnded({ expires_at: null }, now)).toBe(true);
    expect(shareEnded({ expires_at: inDays(3), expired: true }, now)).toBe(true);
    expect(shareEnded({ expires_at: inDays(3) }, now)).toBe(false);
    expect(shareEnded(null, now)).toBe(true);
  });

  it("says who it works for and when it ends", () => {
    expect(shareStatus({ mode: "once", expires_at: inDays(5) }, now)).toBe("Works for one person · ends in 5 days");
    expect(shareStatus({ mode: "week", expires_at: inDays(0.5) }, now)).toBe("Anyone with it can join · ends within a day");
    expect(shareStatus({ mode: "week", expires_at: inDays(-1) }, now)).toMatch(/ended/);
  });
});
