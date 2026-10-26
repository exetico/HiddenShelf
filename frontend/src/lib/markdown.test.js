import { describe, expect, it } from "vitest";
import { markdownToText, renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("formats the simple things", () => {
    expect(renderMarkdown("**bold** *it* _also_ ~~old~~ `x<y`")).toBe(
      "<p><strong>bold</strong> <em>it</em> <em>also</em> <del>old</del> <code>x&lt;y</code></p>",
    );
  });

  it("keeps line breaks and paragraphs", () => {
    expect(renderMarkdown("one\ntwo\n\nthree")).toBe("<p>one<br>two</p><p>three</p>");
  });

  it("renders bullet and numbered lists", () => {
    expect(renderMarkdown("Notes:\n- a\n- b\n\n1. x\n2. y")).toBe(
      "<p>Notes:</p><ul><li>a</li><li>b</li></ul><ol><li>x</li><li>y</li></ol>",
    );
  });

  it("makes safe links open in a new tab", () => {
    const html = renderMarkdown("[docs](https://ex.com/a?b=1&c=2) and https://x.org.");
    expect(html).toContain(
      '<a href="https://ex.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow">docs</a>',
    );
    expect(html).toContain('>https://x.org</a>.');
  });

  it("never lets HTML, scripts or images through", () => {
    const html = renderMarkdown(
      '<img src=x onerror=alert(1)> ![pic](https://x/y.png) [x](javascript:alert(1)) <script>bad()</script>',
    );
    expect(html).not.toMatch(/<img|<script/i);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('href="javascript');
  });

  it("doesn't format inside code or snake_case words", () => {
    expect(renderMarkdown("`**not bold**` my_var_name")).toBe(
      "<p><code>**not bold**</code> my_var_name</p>",
    );
  });

  it("renders headings, kept small", () => {
    expect(renderMarkdown("# Setup\nRun it\n## Notes\n#### Deep **one**")).toBe(
      "<h3>Setup</h3><p>Run it</p><h4>Notes</h4><h5>Deep <strong>one</strong></h5>",
    );
    // Needs the space, like everywhere else
    expect(renderMarkdown("#hashtag")).toBe("<p>#hashtag</p>");
  });

  it("returns nothing for an empty description", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown(null)).toBe("");
  });
});

describe("markdownToText", () => {
  it("drops the marks", () => {
    expect(markdownToText("**Bold** and [a link](https://x.com)\n- item")).toBe(
      "Bold and a link\n• item",
    );
  });
});
