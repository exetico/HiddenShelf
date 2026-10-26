import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/date";

describe("formatDate", () => {
  it("formats the server's UTC timestamps", () => {
    const expected = new Date("2025-10-03T12:00:00Z").toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(formatDate("2025-10-03 12:00:00")).toBe(expected);
    expect(formatDate("2025-10-03T12:00:00Z")).toBe(expected);
  });

  it("returns nothing for a missing or broken date", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});
