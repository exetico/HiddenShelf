import { describe, expect, it } from "vitest";
import { exportBookmarks, folderCategory, parseBookmarks } from "@/lib/bookmarks";

// What Chrome exports, trimmed
const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://news.example/" ADD_DATE="1700000001">News</A>
        <DT><H3>Dev</H3>
        <DL><p>
            <DT><H3>Docs</H3>
            <DL><p>
                <DT><A HREF="https://developer.mozilla.org/" TAGS="web, docs,web">MDN</A>
            </DL><p>
            <DT><A HREF="javascript:void(0)">Bookmarklet</A>
            <DT><A HREF="chrome://settings">Settings</A>
        </DL><p>
    </DL><p>
    <DT><H3>Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="http://nas.lan:5000/">NAS</A>
    </DL><p>
</DL><p>`;

describe("bookmarks", () => {
  it("reads links with their folders, leaving out browser roots and non-web links", () => {
    const found = parseBookmarks(CHROME);
    expect(found.map((b) => [b.title, b.url, b.folders])).toEqual([
      ["News", "https://news.example/", []],
      ["MDN", "https://developer.mozilla.org/", ["Dev", "Docs"]],
      ["NAS", "http://nas.lan:5000/", []],
    ]);
    expect(found[0].addDate).toBe(1700000001);
    expect(found[1].tags).toEqual(["web", "docs"]);
    expect(folderCategory(found[1])).toBe("Docs");
    expect(folderCategory(found[0])).toBe("");
  });

  it("reads nothing from a file that isn't bookmarks", () => {
    expect(parseBookmarks("<p>hi</p>")).toEqual([]);
    expect(parseBookmarks("")).toEqual([]);
  });

  it("writes a file a browser can import, and reads it back", () => {
    const html = exportBookmarks(
      [
        { url: "https://a.dk/?x=1&y=2", title: 'A "quoted" <title>', category_id: 1, created_at: "2024-01-02 03:04:05", tags: [{ name: "t1" }, { name: "t2" }] },
        { url: "https://b.dk/", title: "B", category_id: null, tags: [] },
      ],
      [{ id: 1, name: "Work & play" }],
      { now: 0 },
    );
    expect(html).toMatch(/^<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
    expect(html).toContain('HREF="https://a.dk/?x=1&amp;y=2" ADD_DATE="1704164645" TAGS="t1,t2">A &quot;quoted&quot; &lt;title&gt;</A>');
    const back = parseBookmarks(html);
    expect(back.map((b) => [b.url, b.title, b.folders])).toEqual([
      ["https://a.dk/?x=1&y=2", 'A "quoted" <title>', ["Hidden Shelf", "Work & play"]],
      ["https://b.dk/", "B", ["Hidden Shelf"]],
    ]);
  });
});
