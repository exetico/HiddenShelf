// Browser bookmark files: the "Netscape bookmark file" HTML that Chrome,
// Firefox, Safari and Edge all export and import. Read and written in the
// browser; nothing is sent anywhere until you import the links.

import { LIMITS } from "@/lib/limits";
import { parseUrl } from "@/lib/urlTools";

// Folders browsers put everything in. A link only in one of these has no
// real folder, so it gets no category of its own.
const ROOT_FOLDERS = new Set(
  [
    "bookmarks",
    "bookmarks bar",
    "bookmarks toolbar",
    "bookmarks menu",
    "other bookmarks",
    "mobile bookmarks",
    "favorites",
    "favorites bar",
    "favourites",
    "favourites bar",
    "other favorites",
    "reading list",
  ].map((n) => n.toLowerCase()),
);

const isRootFolder = (h3) =>
  h3.hasAttribute("personal_toolbar_folder") ||
  h3.hasAttribute("unfiled_bookmarks_folder") ||
  ROOT_FOLDERS.has(h3.textContent.trim().toLowerCase());

// The folder heading that owns a <DL>: its <H3>, just before it
function folderHeading(dl) {
  let node = dl.previousElementSibling;
  while (node && node.tagName !== "H3") {
    if (node.tagName === "DL" || node.tagName === "A") return null;
    node = node.previousElementSibling;
  }
  return node;
}

/**
 * The web links in a bookmarks file, in file order:
 * [{ url, title, folders: ["Work", "Docs"], tags: [], addDate }]
 * `folders` runs outermost first and leaves out the browser's own roots.
 * Bookmarklets (javascript:) and browser-internal addresses are skipped.
 */
export function parseBookmarks(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const found = [];
  for (const a of doc.querySelectorAll("a[href]")) {
    const url = parseUrl(a.getAttribute("href"));
    if (!url || !/^https?:$/.test(url.protocol)) continue;
    const folders = [];
    for (let dl = a.closest("dl"); dl; dl = dl.parentElement?.closest("dl")) {
      const h3 = folderHeading(dl);
      if (h3 && !isRootFolder(h3)) folders.unshift(h3.textContent.trim());
    }
    const tags = (a.getAttribute("tags") || "")
      .split(",")
      .map((t) => t.trim().slice(0, LIMITS.tagName))
      .filter(Boolean);
    const added = Number(a.getAttribute("add_date"));
    found.push({
      url: url.href,
      title: a.textContent.trim().slice(0, LIMITS.title),
      folders,
      tags: [...new Set(tags)].slice(0, LIMITS.tagsPerLink),
      addDate: Number.isFinite(added) && added > 0 ? added : null,
    });
  }
  return found;
}

/** The category name for a bookmark: its innermost folder, or "" */
export function folderCategory(bookmark) {
  return (bookmark.folders.at(-1) || "").slice(0, LIMITS.categoryName);
}

const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// created_at is "YYYY-MM-DD HH:MM:SS" in UTC; bookmark files use Unix seconds
function unixTime(createdAt) {
  const ms = Date.parse(`${String(createdAt ?? "").replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * A bookmarks file for these links: a "Hidden Shelf" folder with one
 * folder per category, and the uncategorized links after them. Tags go in
 * TAGS, which Firefox reads (the others ignore it).
 */
export function exportBookmarks(links, categories, { name = "Hidden Shelf", now = Date.now() } = {}) {
  const byCategory = new Map();
  for (const link of links) {
    const key = link.category_id ?? "";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(link);
  }
  const stamp = Math.floor(now / 1000);
  const item = (link, indent) => {
    const attrs = [`HREF="${escapeHtml(link.url)}"`];
    const added = unixTime(link.created_at);
    if (added) attrs.push(`ADD_DATE="${added}"`);
    const tags = (link.tags || []).map((t) => t.name).join(",");
    if (tags) attrs.push(`TAGS="${escapeHtml(tags)}"`);
    return `${indent}<DT><A ${attrs.join(" ")}>${escapeHtml(link.title)}</A>`;
  };
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    `    <DT><H3 ADD_DATE="${stamp}" LAST_MODIFIED="${stamp}">${escapeHtml(name)}</H3>`,
    "    <DL><p>",
  ];
  const sorted = [...categories].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  for (const category of sorted) {
    const inIt = byCategory.get(category.id);
    if (!inIt?.length) continue;
    lines.push(`        <DT><H3 ADD_DATE="${stamp}" LAST_MODIFIED="${stamp}">${escapeHtml(category.name)}</H3>`);
    lines.push("        <DL><p>");
    for (const link of inIt) lines.push(item(link, "            "));
    lines.push("        </DL><p>");
  }
  const known = new Set(categories.map((c) => c.id));
  for (const [key, inIt] of byCategory)
    if (!known.has(key)) for (const link of inIt) lines.push(item(link, "        "));
  lines.push("    </DL><p>", "</DL><p>", "");
  return lines.join("\n");
}
