import { describe, expect, it } from "vitest";
import { bookmarkletHref, quickAddFromQuery } from "@/lib/quickAdd";

describe("quickAddFromQuery", () => {
  it("takes url and title", () => {
    expect(quickAddFromQuery({ url: "https://example.com/a", title: "  A page " })).toEqual({
      url: "https://example.com/a",
      title: "A page",
    });
  });

  it("finds the address inside shared text", () => {
    expect(quickAddFromQuery({ text: "Look at this https://example.com/x?y=1 cool" })).toEqual({
      url: "https://example.com/x?y=1",
      title: "Look at this  cool".trim(),
    });
  });

  it("ignores anything that isn't a web address", () => {
    expect(quickAddFromQuery({})).toBeNull();
    expect(quickAddFromQuery({ url: "javascript:alert(1)" })).toBeNull();
    expect(quickAddFromQuery({ url: "ftp://x" , text: "no link here" })).toBeNull();
  });
});

describe("bookmarkletHref", () => {
  it("opens the add form with the current page", () => {
    const href = bookmarkletHref("https://shelf.example.org/edit?new=1");
    expect(href.startsWith("javascript:")).toBe(true);
    // Run it against a fake page and see where it would go
    const opened = [];
    const fn = new Function("window", "location", "document", href.slice("javascript:".length));
    fn({ open: (u) => opened.push(u) }, { href: "https://news.example/a b" }, { title: "News & more" });
    expect(opened[0]).toBe(
      "https://shelf.example.org/edit?new=1&url=https%3A%2F%2Fnews.example%2Fa%20b&title=News%20%26%20more",
    );
  });
});
