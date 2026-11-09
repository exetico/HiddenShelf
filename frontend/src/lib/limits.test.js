import { describe, expect, it } from "vitest";
import { LIMITS, linkFormProblems, tooLongMessage } from "@/lib/limits";

describe("limits", () => {
  it("says nothing for fields within the limit", () => {
    expect(tooLongMessage("title", "x".repeat(LIMITS.title))).toBeNull();
    expect(linkFormProblems({ url: "https://a.b", title: "t", description: "", icon: "", tags: ["a"] })).toEqual([]);
  });

  it("says how much too long a field is", () => {
    expect(tooLongMessage("description", "x".repeat(LIMITS.description + 1))).toBe(
      "The description is 1 character too long (at most 20,000).",
    );
  });

  it("flags too many tags", () => {
    const tags = Array.from({ length: LIMITS.tagsPerLink + 1 }, (_, i) => `t${i}`);
    expect(linkFormProblems({ tags })).toEqual(["A link can have at most 50 tags."]);
  });
});
