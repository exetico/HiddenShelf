import { describe, expect, it } from "vitest";
import { linkCount } from "@/lib/linkCount";

describe("linkCount", () => {
  it("counts links in plain words", () => {
    expect(linkCount(0)).toBe("0 links");
    expect(linkCount(1)).toBe("1 link");
    expect(linkCount(27)).toBe("27 links");
    expect(linkCount(undefined)).toBe("0 links");
  });
});
