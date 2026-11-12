import { describe, it, expect } from "vitest";
import { archivedCopyUrl, saveCopyUrl } from "./wayback";

describe("Wayback addresses", () => {
  it("points at the newest copy and the save page", () => {
    expect(archivedCopyUrl("https://example.com/a?b=1")).toBe("https://web.archive.org/web/https://example.com/a?b=1");
    expect(saveCopyUrl("http://example.com/")).toBe("https://web.archive.org/save/http://example.com/");
  });

  it("leaves out the #fragment", () => {
    expect(archivedCopyUrl("https://example.com/page#step-3")).toBe("https://web.archive.org/web/https://example.com/page");
  });

  it("gives nothing for addresses that aren't web pages", () => {
    expect(archivedCopyUrl("javascript:alert(1)")).toBe("");
    expect(saveCopyUrl("not a url")).toBe("");
  });
});
