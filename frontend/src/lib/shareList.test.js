import { describe, expect, it } from "vitest";
import { formatList } from "@/lib/shareList";

const links = [
  { title: "Docs [v2]", url: "https://x.dk/a (b)", description: "Read\nthis", tags: [{ name: "a" }, { name: "b" }] },
  { title: "Plain", url: "https://y.dk/", description: "", tags: [] },
];

describe("formatList", () => {
  it("writes Markdown with safe link text and addresses", () => {
    expect(formatList(links, "markdown", { heading: "Work", descriptions: true })).toBe(
      "## Work\n\n- [Docs \\[v2\\]](https://x.dk/a%20%28b%29) – Read this\n- [Plain](https://y.dk/)",
    );
  });

  it("writes plain text", () => {
    expect(formatList(links, "text")).toBe("Docs [v2]\nhttps://x.dk/a (b)\n\nPlain\nhttps://y.dk/");
  });

  it("writes HTML with everything escaped", () => {
    expect(formatList([{ title: "<b>", url: 'https://z.dk/?a="1"' }], "html", { heading: "A & B" })).toBe(
      '<h2>A &amp; B</h2>\n<ul>\n  <li><a href="https://z.dk/?a=&quot;1&quot;">&lt;b&gt;</a></li>\n</ul>',
    );
  });

  it("writes CSV with quoting", () => {
    expect(formatList(links, "csv")).toBe(
      'title,url,description,tags\nDocs [v2],https://x.dk/a (b),Read this,"a, b"\nPlain,https://y.dk/,,',
    );
  });
});
