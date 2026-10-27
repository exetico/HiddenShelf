/**
 * Public link routes — the short URLs people share.
 *
 * Endpoint mapping:
 *   GET /h/:hash                → redirect (direct-redirect links) or the link page
 *   GET /h/:hash?stay           → always the link page
 *   GET /h/:hash/embed          → a small card for other sites' iframes
 *   GET /public/view.html?hash= → old link page URL, redirects to /h/:hash
 *
 * The link page is the Vue build's link.html, served with the link's
 * title and description filled into the <title> and Open Graph tags, so
 * chat apps show a proper preview.
 */

import fs from "node:fs";
import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import { baseUrl, withAbsoluteShareImage } from "../lib/helpers.js";
import { logVisit } from "./linkVisits.js";

const HASH_PATTERN = /^[a-zA-Z0-9]{1,20}$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Descriptions may use simple Markdown; previews want plain text */
export function stripMarkdown(text) {
  return String(text)
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

/**
 * Fill the link's title and description into the page's head.
 * The template marks the values to replace with data-link-meta attributes.
 */
export function renderLinkPage(template, link) {
  const title = `${link.title} — Hidden Shelf`;
  const description =
    (link.description && stripMarkdown(link.description)) ||
    `View "${link.title}" shared via Hidden Shelf`;

  return withAbsoluteShareImage(template)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /(<meta [^>]*data-link-meta="title"[^>]*content=")[^"]*(")/g,
      `$1${escapeHtml(title)}$2`,
    )
    .replace(
      /(<meta [^>]*data-link-meta="description"[^>]*content=")[^"]*(")/g,
      `$1${escapeHtml(description)}$2`,
    );
}

/** The host to show under the title, without "www." */
function displayHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// No scripts, nothing loaded from elsewhere, and any site may frame it
const EMBED_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors *; base-uri 'none'; form-action 'none'";

/**
 * The embeddable card: title, a short description, the site, and a button
 * that opens the public link in a new tab (so visits are counted there).
 * ?theme=light or ?theme=dark fixes the colors; otherwise it follows the
 * visitor's system setting.
 */
export function renderEmbedCard(link, { href, theme = "" }) {
  const description = link.description ? stripMarkdown(link.description) : "";
  const host = displayHost(link.url);
  const light =
    "--bg:#fff;--fg:#232720;--muted:#686f61;--border:#dbded8;--btn:#585f51;--btn-fg:#fff";
  const dark =
    "--bg:#232720;--fg:#f7f7f6;--muted:#bbc2b5;--border:#464c41;--btn:#edeeea;--btn-fg:#232720";
  const colors =
    theme === "dark"
      ? `:root{${dark}}`
      : theme === "light"
        ? `:root{${light}}`
        : `:root{${light}}@media (prefers-color-scheme:dark){:root{${dark}}}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(link.title)}</title>
<style>
${colors}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:transparent}
body{font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg)}
.card{display:flex;align-items:center;gap:12px;height:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:12px}
.icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:var(--border);color:var(--fg)}
.text{flex:1;min-width:0}
h1{margin:0;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
p{margin:2px 0 0;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.host{font-size:12px;-webkit-line-clamp:1}
a.open{flex:none;padding:8px 14px;border-radius:8px;background:var(--btn);color:var(--btn-fg);font-weight:600;text-decoration:none}
a.open:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
@media (max-width:300px){.icon{display:none}}
</style>
</head>
<body>
<div class="card">
<span class="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1M8 13h8v-2H8zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4a5 5 0 0 0 0-10"/></svg></span>
<div class="text">
<h1>${escapeHtml(link.title)}</h1>
${description ? `<p>${escapeHtml(description)}</p>
` : ""}${host ? `<p class="host">${escapeHtml(host)}</p>
` : ""}</div>
<a class="open" href="${escapeHtml(href)}" target="_blank" rel="noopener">Open</a>
</div>
</body>
</html>
`;
}

/**
 * @param {object} options
 * @param {string} options.templatePath  path to the built link.html
 */
export function publicLinkRoutes({ templatePath }) {
  const routes = new Hono();
  let template = null;

  routes.get("/h/:hash", (c) => {
    const hash = c.req.param("hash");
    if (!HASH_PATTERN.test(hash)) {
      return c.text("Invalid link", 404);
    }
    const db = getDb();
    const link = db
      .prepare(
        "SELECT id, url, title, description, direct_redirect FROM links WHERE hash = ? AND is_public = 1 AND deleted_at IS NULL",
      )
      .get(hash);

    if (!link) {
      return c.text("Link not found", 404);
    }

    // Direct redirect: go straight to the URL. The page logs its own
    // visits, so only this path logs here.
    if (link.direct_redirect && c.req.query("stay") === undefined) {
      logVisit(db, link.id, c);
      return c.redirect(link.url, 302);
    }

    if (template === null) {
      try {
        template = fs.readFileSync(templatePath, "utf8");
      } catch {
        return c.text("The frontend is not built yet", 503);
      }
    }
    return c.html(renderLinkPage(template, link));
  });

  routes.get("/h/:hash/embed", (c) => {
    const hash = c.req.param("hash");
    const link = HASH_PATTERN.test(hash)
      ? getDb()
          .prepare(
            "SELECT url, title, description FROM links WHERE hash = ? AND is_public = 1 AND deleted_at IS NULL",
          )
          .get(hash)
      : null;
    if (!link) return c.text("Link not found", 404);
    c.header("Content-Security-Policy", EMBED_CSP);
    return c.html(
      renderEmbedCard(link, {
        href: baseUrl(`/h/${hash}`),
        theme: c.req.query("theme") || "",
      }),
    );
  });

  // Links shared before the page moved
  routes.get("/public/view.html", (c) => {
    const hash = c.req.query("hash") || "";
    if (!HASH_PATTERN.test(hash)) {
      return c.redirect(baseUrl("/"), 302);
    }
    const stay = c.req.query("stay") !== undefined ? "?stay" : "";
    return c.redirect(baseUrl(`/h/${hash}${stay}`), 301);
  });

  return routes;
}
