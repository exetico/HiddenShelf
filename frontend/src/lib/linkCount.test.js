import { describe, expect, it } from "vitest";
import { linkCount, shownCount } from "@/lib/linkCount";

describe("linkCount", () => {
  it("counts links in plain words", () => {
    expect(linkCount(0)).toBe("0 links");
    expect(linkCount(1)).toBe("1 link");
    expect(linkCount(27)).toBe("27 links");
    expect(linkCount(undefined)).toBe("0 links");
  });
});

describe("shownCount", () => {
  it("counts the shelf, or what the filters show of it", () => {
    expect(shownCount(12, 12, false)).toBe("12 links");
    expect(shownCount(3, 12, true)).toBe("Showing 3 of 12 links");
    expect(shownCount(1, 1, true)).toBe("Showing 1 of 1 link");
    // A hidden category can hold more than the (visible) shelf count
    expect(shownCount(15, 12, true)).toBe("15 links");
  });
});
